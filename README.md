# activity-timer-server

Backend for the M5Stick Activity Timer. An Express + SQLite (`better-sqlite3`) API
that stores **activities** and time-tracking **events** (`start`/`end`). It serves
two clients:

- The **M5Stick firmware**, which reads the enabled activity list and the current
  time, then posts `start`/`end` events.
- A **web frontend** for managing activities and reviewing/correcting event history.

## Requirements

- Node.js 20+
- SQLite is embedded via `better-sqlite3` — no separate database to install.

> Note: `better-sqlite3` is pinned to `11.8.1`; v13 prebuilds segfault in Docker.

## Getting started

```bash
npm install
npm start
```

The server listens on `http://localhost:3000/` (override with `PORT`). On first
start it creates the SQLite file and, if the `activities` table is empty, seeds a
default set (edit `SEED_ACTIVITIES` in [`src/db.js`](src/db.js)).

### Environment variables

Configured via `.env` (loaded with `dotenv`):

| Variable  | Default              | Description                          |
| --------- | -------------------- | ------------------------------------ |
| `PORT`    | `3000`               | HTTP port to listen on.              |
| `DB_PATH` | `./data/activity.db` | Path to the SQLite database file.    |

### Scripts

| Command       | Description                                                          |
| ------------- | ------------------------------------------------------------------- |
| `npm start`   | Run the server (`src/server.js`).                                   |
| `npm run wipe`| Delete the DB file plus its WAL/SHM sidecars. Tables and seed data rebuild on next start. |

## Docker

```bash
docker compose up --build
```

The database is persisted to `./data` via a bind mount, and the container runs as
the non-root `node` user. Compose loads environment from `.env`.

## Data model

- **activities** — `id`, `name` (unique), `disabled` (0/1), `created_at`.
  Disable rather than delete to keep history; deleting an activity also removes
  its events.
- **events** — `id`, `event_type` (`start` | `end`), `timestamp` (epoch seconds),
  `created_at`, `activity_id` (FK → `activities.id`).

SQLite runs in WAL mode with foreign keys enabled.

## API

### Device / system routes

Shapes consumed by the M5Stick firmware are a **frozen contract** — don't change them.

| Method | Path             | Description                                                       |
| ------ | ---------------- | ----------------------------------------------------------------- |
| `GET`  | `/`              | Health check (`hello world`).                                     |                                               |
| `GET`  | `/time`          | Device clock source. `{ time: <unix_seconds> }`.                  |
| `GET`  | `/activity-list` | Enabled activities only. `{ activities: [{ id, name }] }`.        |
| `POST` | `/reset`         | **DEV ONLY, DESTRUCTIVE** — wipes all data and re-seeds. |

### Activities (CRUD for a frontend)

| Method   | Path              | Description                                                  |
| -------- | ----------------- | ------------------------------------------------------------ |
| `GET`    | `/activities`     | All activities, including disabled.                          |
| `GET`    | `/activities/:id` | One activity.                                                |
| `POST`   | `/activities`     | Create. Body: `{ name }`.                                    |
| `PATCH`  | `/activities/:id` | Rename and/or toggle disabled. Body: `{ name?, disabled? }`. |
| `DELETE` | `/activities/:id` | Hard delete (also removes the activity's events).            |

### Events

| Method   | Path          | Description                                                                    |
| -------- | ------------- | ------------------------------------------------------------------------------ |
| `GET`    | `/events`     | Filtered, paginated list. Query: `activity_id`, `event_type`, `from`, `to`, `limit` (default 100, max 500), `offset`. Returns `{ data, meta: { total, limit, offset } }`. |
| `GET`    | `/events/:id` | One event.                                                                     |
| `POST`   | `/events`     | Create. Body: `{ event_type, timestamp, activity_id }`. The firmware posts here. |
| `PATCH`  | `/events/:id` | Correct an event. Body: any of `{ event_type, timestamp, activity_id }`.       |
| `DELETE` | `/events/:id` | Delete an event.                                                               |

Successful reads/writes return `{ data: ... }`; errors return `{ error: <message> }`
with an appropriate status code. CORS is enabled so a frontend can call from another origin.
