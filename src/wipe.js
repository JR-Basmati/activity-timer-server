import { rmSync } from 'node:fs';

// Resolve the same path db.js uses. We intentionally do NOT import db.js -
// that would open a connection and lock the file we're trying to delete.
const DB_PATH = process.env.DB_PATH || './data/activity.db';

// SQLite keeps the main file plus -wal / -shm sidecars in WAL mode.
// force:true means no error if a file isn't there.
for(const suffix of ['', '-wal', '-shm']){
    rmSync(DB_PATH + suffix, { force: true });
}

console.log(`Wiped ${DB_PATH} (+ WAL/SHM). Tables and seed rebuild on next start.`);
