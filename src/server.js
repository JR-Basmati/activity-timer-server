import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import systemRouter from './routes/system.js';
import activitiesRouter from './routes/activities.js';
import eventsRouter from './routes/events.js';

const app = express();
const PORT = process.env.PORT || 3000;

//CORS so a browser frontend on a different origin (e.g. Vite :5173) can call us.
app.use(cors());
app.use(express.json());

//Device contract + system routes: /, /ping, /time, /activity-list, /reset
app.use('/', systemRouter);
//Frontend CRUD
app.use('/activities', activitiesRouter);
app.use('/events', eventsRouter);

app.listen(PORT, () => {
    console.log(`Express server running at http://localhost:${PORT}/`);
});
