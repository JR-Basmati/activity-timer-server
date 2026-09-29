import { Router } from 'express';
import db from '../db.js';

const router = Router();

const EVENT_COLS = 'id, event_type, timestamp, created_at, activity_id';

const getOne = db.prepare(`SELECT ${EVENT_COLS} FROM events WHERE id = ?`);
const insert = db.prepare('INSERT INTO events (event_type, timestamp, activity_id) VALUES (?, ?, ?)');
const del    = db.prepare('DELETE FROM events WHERE id = ?');

router.param('id', (req, res, next, val) => {
    const id = Number(val);
    if(!Number.isInteger(id) || id < 1){
        return res.status(400).json({ error: 'Invalid event id' });
    }
    req.eventId = id;
    next();
});

//GET /events - filtered + paginated list. Query params (all optional):
//  activity_id, event_type, from, to (epoch), limit (default 100, max 500), offset
router.get('/', (req, res) => {
    const { activity_id, event_type, from, to } = req.query;

    const where = [];
    const params = {};
    if(activity_id !== undefined){ where.push('activity_id = @activity_id'); params.activity_id = Number(activity_id); }
    if(event_type !== undefined){ where.push('event_type = @event_type'); params.event_type = event_type; }
    if(from !== undefined){ where.push('timestamp >= @from'); params.from = Number(from); }
    if(to !== undefined){ where.push('timestamp <= @to'); params.to = Number(to); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const limit  = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const total = db.prepare(`SELECT COUNT(*) AS c FROM events ${whereSql}`).get(params).c;
    const rows = db.prepare(
        `SELECT ${EVENT_COLS} FROM events ${whereSql} ORDER BY timestamp DESC, id DESC LIMIT @limit OFFSET @offset`
    ).all({ ...params, limit, offset });

    return res.json({ data: rows, meta: { total, limit, offset } });
});

//GET /events/:id
router.get('/:id', (req, res) => {
    const event = getOne.get(req.eventId);
    if(!event){
        return res.status(404).json({ error: 'Event not found' });
    }
    return res.json({ data: event });
});

//POST /events - create. Body: { event_type, timestamp, activity_id }
//Also the endpoint the M5Stick firmware posts to (it only reads the status code).
router.post('/', (req, res) => {
    const { event_type, timestamp, activity_id } = req.body;

    if(event_type == null || timestamp == null || activity_id == null){
        return res.status(400).json({ error: "Invalid payload. Required: { event_type: 'start'|'end', timestamp: number, activity_id: number }" });
    }

    try{
        const info = insert.run(event_type, timestamp, activity_id);
        return res.status(201).json({ data: getOne.get(info.lastInsertRowid) });
    }catch(err){
        return res.status(400).json({ error: err.message });
    }
});

//PATCH /events/:id - correct a mistaken event. Body: any of
//  { event_type, timestamp, activity_id }
router.patch('/:id', (req, res) => {
    const existing = getOne.get(req.eventId);
    if(!existing){
        return res.status(404).json({ error: 'Event not found' });
    }

    const { event_type, timestamp, activity_id } = req.body;
    if(event_type === undefined && timestamp === undefined && activity_id === undefined){
        return res.status(400).json({ error: "Provide at least one of: 'event_type', 'timestamp', 'activity_id'" });
    }

    const newType = event_type === undefined ? existing.event_type : event_type;
    const newTs   = timestamp  === undefined ? existing.timestamp  : timestamp;
    const newAct  = activity_id === undefined ? existing.activity_id : activity_id;

    try{
        db.prepare('UPDATE events SET event_type = ?, timestamp = ?, activity_id = ? WHERE id = ?')
          .run(newType, newTs, newAct, req.eventId);
        return res.json({ data: getOne.get(req.eventId) });
    }catch(err){
        return res.status(400).json({ error: err.message });
    }
});

//DELETE /events/:id
router.delete('/:id', (req, res) => {
    const existing = getOne.get(req.eventId);
    if(!existing){
        return res.status(404).json({ error: 'Event not found' });
    }
    del.run(req.eventId);
    return res.status(204).end();
});

export default router;
