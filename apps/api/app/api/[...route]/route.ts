import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'

import auth from './authRoutes';
import data from './data';
import directories from './directoriesRoutes';
import users from './usersRoutes';
import gardens from './gardensRoutes';
import { openApiDocs } from '@gredice/apidocs/openApiDocs';
import { openAPISpecs } from 'hono-openapi';

export const dynamic = 'force-dynamic'

const app = new Hono()
    .basePath('/api')
    .use('*', cors({
        origin: "*",
        allowHeaders: ["Origin", "Content-Type", "Authorization"],
        allowMethods: ["OPTIONS", "GET", "POST", "PUT", "DELETE", "PATCH"],
        credentials: true,
    }))
    .route('/auth', auth)
    .route('/directories', directories)
    .route('/users', users)
    .route('/gardens', gardens)
    .route('/data', data);

app
    .get(`/docs/auth`, openAPISpecs(auth, {
        documentation: {
            info: {
                title: 'Auth API',
                version: '0.1.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/auth',
                    description: 'Production server'
                }
            ]
        }
    }))
    .get(`/docs/users`, openAPISpecs(users, {
        documentation: {
            info: {
                title: 'Users API',
                version: '0.1.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/users',
                    description: 'Production server'
                }
            ]
        }
    }))
    .get(`/docs/gardens`, openAPISpecs(gardens, {
        documentation: {
            info: {
                title: 'Gardens API',
                version: '0.1.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/gardens',
                    description: 'Production server'
                }
            ]
        }
    }))
    .get('/docs/directories', async (context) => context.json(await openApiDocs()))
    .get(`/docs/data`, openAPISpecs(data, {
        documentation: {
            info: {
                title: 'Data API',
                version: '0.1.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/data',
                    description: 'Production server'
                }
            ]
        }
    }))

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);

export type AppType = typeof app;
