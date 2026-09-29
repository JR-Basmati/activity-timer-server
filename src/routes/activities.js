import { Router } from 'express';
import db from '../db.js';

const router = Router();

const getAll  = db.prepare('SELECT id, name, disabled, created_at FROM activities ORDER BY id');
const getOne  = db.prepare('SELECT id, name, disabled, created_at FROM activities WHERE id = ?');
const insert  = db.prepare('INSERT INTO activities (name) VALUES (?)');
const update  = db.prepare('UPDATE activities SET name = ?, disabled = ? WHERE id = ?');
const del     = db.prepare('DELETE FROM activities WHERE id = ?');
const delEvts = db.prepare('DELETE FROM events WHERE activity_id = ?');

//Validate :id once for every route that has it, exposing it as req.activityId.
router.param('id', (req, res, next, val) => {
    const id = Number(val);
    if(!Number.isInteger(id) || id < 1){
        return res.status(400).json({ error: 'Invalid activity id' });
    }
    req.activityId = id;
    next();
});

//GET /activities - all activities, including disabled (frontend management view).
router.get('/', (req, res) => {
    return res.json({ data: getAll.all() });
});

//GET /activities/:id
router.get('/:id', (req, res) => {
    const activity = getOne.get(req.activityId);
    if(!activity){
        return res.status(404).json({ error: 'Activity not found' });
    }
    return res.json({ data: activity });
});

//POST /activities - create. Body: { name }
router.post('/', (req, res) => {
    const { name } = req.body;
    if(!name){
        return res.status(400).json({ error: "Missing required field: 'name'" });
    }
    try{
        const info = insert.run(name);
        return res.status(201).json({ data: getOne.get(info.lastInsertRowid) });
    }catch(err){
        return res.status(400).json({ error: err.message });
    }
});

//PATCH /activities/:id - rename and/or toggle disabled. Body: { name?, disabled? }
router.patch('/:id', (req, res) => {
    const existing = getOne.get(req.activityId);
    if(!existing){
        return res.status(404).json({ error: 'Activity not found' });
    }

    const { name, disabled } = req.body;
    if(name === undefined && disabled === undefined){
        return res.status(400).json({ error: "Provide at least one of: 'name', 'disabled'" });
    }

    //Only overwrite fields that were actually provided.
    const newName     = name === undefined ? existing.name : name;
    const newDisabled = disabled === undefined ? existing.disabled : (disabled ? 1 : 0);

    try{
        update.run(newName, newDisabled, req.activityId);
        return res.json({ data: getOne.get(req.activityId) });
    }catch(err){
        return res.status(400).json({ error: err.message });
    }
});

//DELETE /activities/:id - hard delete. Also removes the activity's events
//(FK requires events gone first). Use PATCH { disabled: true } to keep history.
router.delete('/:id', (req, res) => {
    const existing = getOne.get(req.activityId);
    if(!existing){
        return res.status(404).json({ error: 'Activity not found' });
    }

    const removeAll = db.transaction((id) => {
        delEvts.run(id);
        del.run(id);
    });
    removeAll(req.activityId);

    return res.status(204).end();
});

export default router;
