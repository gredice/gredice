import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'

import auth from './authRoutes';
import data from './data';
import directories from './directoriesRoutes';
import users from './usersRoutes';
import gardens from './gardensRoutes';

export const dynamic = 'force-dynamic'

const app = new Hono()
    .basePath('/api');

app.use('*', cors({
    origin: "*",
    allowHeaders: ["Origin", "Content-Type", "Authorization"],
    allowMethods: ["OPTIONS", "GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
}));

app.route('/auth', auth)
    .route('/directories', directories)
    .route('/users', users)
    .route('/data', data)
    .route('/gardens', gardens);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);

export type AppType = typeof app.routes;
