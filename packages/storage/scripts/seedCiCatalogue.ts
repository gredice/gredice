import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
    attributeValues,
    cmsPages,
    entities,
    entityTypes,
} from '../src/schema';
import { closeStorage, storage } from '../src/storage';

const fixtureSchema = z.object({
    types: z.array(z.object({ name: z.string(), label: z.string() })),
    entities: z.array(
        z.object({
            id: z.number(),
            entityTypeName: z.string(),
            state: z.literal('published'),
        }),
    ),
    definitions: z.array(
        z.object({
            id: z.number(),
            entityTypeName: z.string(),
            category: z.string(),
            name: z.string(),
            label: z.string(),
            dataType: z.string(),
            multiple: z.boolean(),
            required: z.boolean(),
            display: z.boolean(),
        }),
    ),
    values: z.array(
        z.object({
            entityId: z.number(),
            entityTypeName: z.string(),
            attributeDefinitionId: z.number(),
            value: z.string().nullable(),
            order: z.string().nullable(),
        }),
    ),
});

// Never seed an existing preview/production database, even when invoked by hand.
const url = new URL(process.env.POSTGRES_URL ?? 'http://invalid');
if (
    process.env.TEST_ENV !== '1' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/gredice_ci'
) {
    throw new Error(
        'CI fixtures require the disposable loopback gredice_ci database.',
    );
}

try {
    const fixture = fixtureSchema.parse(
        JSON.parse(
            await readFile(
                new URL('../tests/fixtures/ci-catalogue.json', import.meta.url),
                'utf8',
            ),
        ),
    );
    const updatedAt = new Date('2025-01-01T12:00:00.000Z');
    const db = storage();
    await db.transaction(async (tx) => {
        await tx
            .insert(entityTypes)
            .values(fixture.types.map((row) => ({ ...row, updatedAt })));
        const categories = new Map(
            fixture.definitions.map((row) => [
                `${row.entityTypeName}:${row.category}`,
                {
                    name: row.category,
                    label: row.category,
                    entityTypeName: row.entityTypeName,
                    updatedAt,
                },
            ]),
        );
        await tx
            .insert(attributeDefinitionCategories)
            .values([...categories.values()]);
        await tx
            .insert(attributeDefinitions)
            .values(fixture.definitions.map((row) => ({ ...row, updatedAt })));
        await tx.insert(entities).values(
            fixture.entities.map((row) => ({
                ...row,
                updatedAt,
                publishedAt: updatedAt,
            })),
        );
        await tx
            .insert(attributeValues)
            .values(fixture.values.map((row) => ({ ...row, updatedAt })));
        await tx.insert(cmsPages).values([
            {
                slug: 'novosti/ci-testni-vrt',
                title: 'Testni vrt za pregled novosti',
                content:
                    '<p>Deterministički lokalni sadržaj za testove novosti.</p>',
                contentKind: 'blog',
                category: 'Vrt',
                state: 'published',
                publishedAt: updatedAt,
                updatedAt,
            },
            {
                slug: 'novosti/sto-je-novo/ci-testna-promjena',
                title: 'Testna promjena u Gredicama',
                content:
                    '<p>Deterministički lokalni sadržaj za testove promjena.</p>',
                contentKind: 'changelog',
                state: 'published',
                publishedAt: updatedAt,
                updatedAt,
            },
        ]);
    });
    console.info(
        `Seeded ${fixture.entities.length} local CI catalogue entities.`,
    );
} finally {
    await closeStorage();
}
