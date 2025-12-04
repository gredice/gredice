import { type Env, Hono, type Schema } from 'hono';
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
import inventoryRoutes from './inventoryRoutes';
import notificationsRoutes from './notificationsRoutes';
import occasionsRoutes from './occasionsRoutes';
import shoppingCartRoutes from './shoppingCartRoutes';
import usersRoutes from './usersRoutes';

export const dynamic = 'force-dynamic';

function docs<E extends Env, S extends Schema, P extends string>(
    routes: Hono<E, S, P>,
    title: string,
    path: string,
) {
    return openAPIRouteHandler(routes, {
        documentation: {
            info: {
                title,
                version: '1.0.0',
            },
            servers: [
                {
                    url: `https://api.gredice.com/api/${path}`,
                    description: 'Production server',
                },
                {
                    url: `https://api.gredice.test/api/${path}`,
                    description: 'Local development server',
                },
            ],
        },
    });
}

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
    .route('/inventory', inventoryRoutes)
    .route('/shopping-cart', shoppingCartRoutes)
    .route('/checkout', checkoutRoutes)
    .route('/delivery', deliveryRoutes)
    .route('/data', dataRoutes)
    .route('/notifications', notificationsRoutes);

app.get('/docs/auth', docs(authRoutes, 'Auth API', 'auth'))
    .get('/docs/accounts', docs(accountsRoutes, 'Accounts API', 'accounts'))
    .get('/docs/users', docs(usersRoutes, 'Users API', 'users'))
    .get('/docs/gardens', docs(gardensRoutes, 'Gardens API', 'gardens'))
    .get('/docs/directories', async (context) =>
        context.json(await openApiDocs()),
    )
    .get('/docs/data', docs(dataRoutes, 'Data API', 'data'))
    .get('/docs/feedback', docs(feedbackRoutes, 'Feedback API', 'feedback'))
    .get('/docs/occasions', docs(occasionsRoutes, 'Occasions API', 'occasions'))
    .get(
        '/docs/shopping-cart',
        docs(shoppingCartRoutes, 'Shopping Cart API', 'shopping-cart'),
    )
    .get('/docs/inventory', docs(inventoryRoutes, 'Inventory API', 'inventory'))
    .get('/docs/checkout', docs(checkoutRoutes, 'Checkout API', 'checkout'))
    .get('/docs/delivery', docs(deliveryRoutes, 'Delivery API', 'delivery'))
    .get(
        '/docs/notifications',
        docs(notificationsRoutes, 'Notifications API', 'notifications'),
    );

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);

export type AppType = typeof app;
