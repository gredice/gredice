import { openAPISpecs } from 'hono-openapi';
import { ApiReference } from '@scalar/nextjs-api-reference';
import { Hono } from 'hono';

export function apiDocs(app: Hono, slug: string, documentation: Exclude<Parameters<typeof openAPISpecs>[1], undefined>['documentation']) {
    return app
        .get(
            "/docs",
            openAPISpecs(app, { documentation })
        )
        .get(`/docs/${slug}`, ApiReference({
            spec: {
                url: `/api/${slug}/docs`
            },
        }));
}