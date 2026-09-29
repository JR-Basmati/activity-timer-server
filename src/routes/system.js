import { Router } from 'express';
import db, { resetDb } from '../db.js';

const router = Router();

//Enabled activities only, shaped exactly as the M5Stick firmware expects.
//This is the frozen DEVICE contract - do not change its shape.
const getEnabledActivities = db.prepare(
    'SELECT id, name FROM activities WHERE disabled = 0 ORDER BY id'
);

router.get('/', (req, res) => {
    return res.send('hello world');
});


//Device clock source. Returns { time: <unix_seconds> }.
router.get('/time', (req, res) => {
    return res.status(200).json({ time: Math.floor(Date.now() / 1000) });
});

//Device activity list. Returns { activities: [ {id, name}, ... ] } (enabled only).
router.get('/activity-list', (req, res) => {
    return res.status(200).json({ activities: getEnabledActivities.all() });
});

//DEV TOOL: wipe all data and re-seed. Remove or protect before any
//non-local deployment - it destroys all events and activities.
router.post('/reset', (req, res) => {
    resetDb();
    return res.json({ ok: true, message: 'Database reset and re-seeded.' });
});

export default router;
