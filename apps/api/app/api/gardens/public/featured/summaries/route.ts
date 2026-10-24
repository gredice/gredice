import { getFeaturedPublicGardenSummaries } from '@gredice/storage';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/vercel';
import { featuredPublicGardenSummariesRoute } from '../../../../../../lib/garden/featuredPublicGardenSummariesRoute';
import { resolveCorsOrigin } from '../../../../../../lib/http/corsOrigins';

export const dynamic = 'force-dynamic';

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
    .route(
        '/',
        featuredPublicGardenSummariesRoute(getFeaturedPublicGardenSummaries),
    );

export const GET = handle(app);
export const OPTIONS = handle(app);
