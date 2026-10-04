import { getFeaturedPublicGardens } from '@gredice/storage';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { featuredPublicGardensRoute } from '../../../../../lib/garden/featuredPublicGardensRoute';
import { resolveCorsOrigin } from '../../../../../lib/http/corsOrigins';

export const dynamic = 'force-dynamic';

// Keep the homepage's first API hop out of the catch-all route, which loads
// every API domain before its handler can return headers.
const app = new Hono()
    .basePath('/api/gardens')
    .use(
        '*',
        cors({
            origin: resolveCorsOrigin,
            allowHeaders: ['Origin', 'Content-Type', 'Authorization'],
            allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            credentials: true,
        }),
    )
    .route('/', featuredPublicGardensRoute(getFeaturedPublicGardens));

export const GET = handle(app);
export const OPTIONS = handle(app);
