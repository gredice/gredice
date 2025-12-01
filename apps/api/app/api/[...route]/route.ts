import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { openAPIRouteHandler } from 'hono-openapi';
import { openApiDocs } from '../../../lib/docs/openApiDocs';
import accountsRoutes from './accountsRoutes';
import authRoutes from './authRoutes';
import checkoutRoutes from './checkoutRoutes';
import dataRoutes from './data';
import deliveryRoutes from './deliveryRoutes';
import directoriesRoutes from './directoriesRoutes';
import feedbackRoutes from './feedbackRoutes';
import gardensRoutes from './gardensRoutes';
import notificationsRoutes from './notificationsRoutes';
import occasionsRoutes from './occasionsRoutes';
import shoppingCartRoutes from './shoppingCartRoutes';
import usersRoutes from './usersRoutes';

export const dynamic = 'force-dynamic';

const app = new Hono()
    .basePath('/api')
    .use(
        '*',
        cors({
            origin: '*',
            allowHeaders: ['Origin', 'Content-Type', 'Authorization'],
            allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            credentials: true,
        }),
    )
    .route('/auth', authRoutes)
    .route('/directories', directoriesRoutes)
    .route('/accounts', accountsRoutes)
    .route('/users', usersRoutes)
    .route('/gardens', gardensRoutes)
    .route('/feedback', feedbackRoutes)
    .route('/occasions', occasionsRoutes)
    .route('/shopping-cart', shoppingCartRoutes)
    .route('/checkout', checkoutRoutes)
    .route('/delivery', deliveryRoutes)
    .route('/data', dataRoutes)
    .route('/notifications', notificationsRoutes);

app.get(
    `/docs/auth`,
    openAPIRouteHandler(authRoutes, {
        documentation: {
            info: {
                title: 'Auth API',
                version: '1.0.0',
            },
            servers: [
                {
                    url: 'https://api.gredice.com/api/auth',
                    description: 'Production server',
                },
                {
                    url: 'https://api.gredice.test/api/auth',
                    description: 'Local development server',
                },
            ],
        },
    }),
)
    .get(
        `/docs/accounts`,
        openAPIRouteHandler(accountsRoutes, {
            documentation: {
                info: {
                    title: 'Accounts API',
                    version: '1.0.0',
                },
                servers: [
                    {
                        url: 'https://api.gredice.com/api/accounts',
                        description: 'Production server',
                    },
                    {
                        url: 'https://api.gredice.test/api/accounts',
                        description: 'Local development server',
                    },
                ],
            },
        }),
    )
    .get(
        `/docs/users`,
        openAPIRouteHandler(usersRoutes, {
            documentation: {
                info: {
                    title: 'Users API',
                    version: '1.0.0',
                },
                servers: [
                    {
                        url: 'https://api.gredice.com/api/users',
                        description: 'Production server',
                    },
                    {
                        url: 'https://api.gredice.test/api/users',
                        description: 'Local development server',
                    },
                ],
            },
        }),
    )
    .get(
        `/docs/gardens`,
        openAPIRouteHandler(gardensRoutes, {
            documentation: {
                info: {
                    title: 'Gardens API',
                    version: '1.0.0',
                },
                servers: [
                    {
                        url: 'https://api.gredice.com/api/gardens',
                        description: 'Production server',
                    },
                    {
                        url: 'https://api.gredice.test/api/gardens',
                        description: 'Local development server',
                    },
                ],
            },
        }),
    )
    .get('/docs/directories', async (context) =>
        context.json(await openApiDocs()),
    )
    .get(
        `/docs/data`,
        openAPIRouteHandler(dataRoutes, {
            documentation: {
                info: {
                    title: 'Data API',
                    version: '1.0.0',
                },
                servers: [
                    {
                        url: 'https://api.gredice.com/api/data',
                        description: 'Production server',
                    },
                    {
                        url: 'https://api.gredice.test/api/data',
                        description: 'Local development server',
                    },
                ],
            },
        }),
    );

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);

export type AppType = typeof app;
