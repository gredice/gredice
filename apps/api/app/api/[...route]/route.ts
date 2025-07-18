import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'

import authRoutes from './authRoutes';
import dataRoutes from './data';
import directoriesRoutes from './directoriesRoutes';
import accountsRoutes from './accountsRoutes';
import usersRoutes from './usersRoutes';
import gardensRoutes from './gardensRoutes';
import feedbackRoutes from './feedbackRoutes';
import shoppingCartRoutes from './shoppingCartRoutes';
import checkoutRoutes from './checkoutRoutes';
import notificationsRoutes from './notificationsRoutes';
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
    .route('/auth', authRoutes)
    .route('/directories', directoriesRoutes)
    .route('/accounts', accountsRoutes)
    .route('/users', usersRoutes)
    .route('/gardens', gardensRoutes)
    .route('/feedback', feedbackRoutes)
    .route('/shopping-cart', shoppingCartRoutes)
    .route('/checkout', checkoutRoutes)
    .route('/data', dataRoutes)
    .route('/notifications', notificationsRoutes);

app
    .get(`/docs/auth`, openAPISpecs(authRoutes, {
        documentation: {
            info: {
                title: 'Auth API',
                version: '1.0.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/auth',
                    description: 'Production server'
                },
                {
                    url: 'http://localhost:3005/api/auth',
                    description: 'Local development server'
                },
            ]
        }
    }))
    .get(`/docs/accounts`, openAPISpecs(accountsRoutes, {
        documentation: {
            info: {
                title: 'Accounts API',
                version: '1.0.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/accounts',
                    description: 'Production server'
                },
                {
                    url: 'http://localhost:3005/api/accounts',
                    description: 'Local development server'
                },
            ]
        }
    }))
    .get(`/docs/users`, openAPISpecs(usersRoutes, {
        documentation: {
            info: {
                title: 'Users API',
                version: '1.0.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/users',
                    description: 'Production server'
                },
                {
                    url: 'http://localhost:3005/api/users',
                    description: 'Local development server'
                },
            ]
        }
    }))
    .get(`/docs/gardens`, openAPISpecs(gardensRoutes, {
        documentation: {
            info: {
                title: 'Gardens API',
                version: '1.0.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/gardens',
                    description: 'Production server'
                },
                {
                    url: 'http://localhost:3005/api/gardens',
                    description: 'Local development server'
                },
            ]
        }
    }))
    .get('/docs/directories', async (context) => context.json(await openApiDocs()))
    .get(`/docs/data`, openAPISpecs(dataRoutes, {
        documentation: {
            info: {
                title: 'Data API',
                version: '1.0.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/data',
                    description: 'Production server'
                },
                {
                    url: 'http://localhost:3005/api/data',
                    description: 'Local development server'
                },
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
