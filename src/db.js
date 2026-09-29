import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';


const DB_PATH = process.env.DB_PATH || './data/activity.db';

//Make sure the dir exists before opening the file.
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

//WAL gives better concurrent-read behavior; foreign_keys is OFF by
//default in SQLite and must be enabled per-connection.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`CREATE TABLE IF NOT EXISTS activities
    (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        disabled INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT(unixepoch())
    )`
);

db.exec(`CREATE TABLE IF NOT EXISTS events
    (
        id INTEGER PRIMARY KEY,
        event_type TEXT NOT NULL CHECK (event_type IN ('start', 'end')),
        timestamp INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT(unixepoch()),
        activity_id INTEGER NOT NULL REFERENCES activities(id)
    )`
);

//Default activities to load into a fresh/empty DB (e.g. after a wipe).
//Edit this list to change what gets seeded.
const SEED_ACTIVITIES = [
    'ONPro Site',
    'Bathroom Renos',
    'Cooking',
    'Break',
    'Bedtime (incl. Wind down)',
];

//Insert the default activities. Wrapped in a transaction - one commit not N.
function seedDefaultActivities(){
    const insert = db.prepare('INSERT INTO activities (name) VALUES (?)');
    const insertMany = db.transaction((names) => {
        for(const name of names){
            insert.run(name);
        }
    });
    insertMany(SEED_ACTIVITIES);
}

//Seed only when the table is empty so restarts don't duplicate rows.
const { count } = db.prepare('SELECT COUNT(*) AS count FROM activities').get();
if(count === 0){
    seedDefaultActivities();
    console.log(`Seeded ${SEED_ACTIVITIES.length} default activities.`);
}

//Wipe all data and re-seed. Backs the POST /reset dev endpoint.
//DESTRUCTIVE - clears events then activities (FK order), then reseeds.
export function resetDb(){
    const run = db.transaction(() => {
        db.exec('DELETE FROM events');
        db.exec('DELETE FROM activities');
        seedDefaultActivities();
    });
    run();
    console.log('Database reset and re-seeded.');
}

export default db;
