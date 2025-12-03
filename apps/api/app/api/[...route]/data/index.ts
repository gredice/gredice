import { Hono } from 'hono';
import statistics from './statisticsRoutes';
import weather from './weatherRoutes';

const app = new Hono()
    .route('/weather', weather)
    .route('/statistics', statistics);

export default app;
