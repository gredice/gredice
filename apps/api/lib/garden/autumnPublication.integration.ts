import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { closeStorage, storage } from '@gredice/storage';
import { and, eq, sql } from 'drizzle-orm';
import { verifyAutumnPublicationDeployment } from '../../../../packages/storage/src/helpers/autumnPublicationDeployment';
import {
    publicationAttributeMap,
    publicationDigest,
} from '../../../../packages/storage/src/helpers/autumnPublicationPlan';
import {
    applyAutumnPublicationPlan,
    exportAutumnPublicationCms,
} from '../../../../packages/storage/src/repositories/autumnPublicationRepo';
import {
    attributeDefinitionCategories,
    attributeDefinitions,
    attributeValues,
    entities,
    entityRevisions,
    entityTypes,
} from '../../../../packages/storage/src/schema/cmsSchema';
import {
    publicationFixtureCms,
    publicationFixtureSource,
} from '../../../../scripts/autumn-publication-plan.fixtures';
import { createAutumnPublicationPlan } from '../../../../scripts/autumn-publication-plan-core';
import { repositoryReader } from '../../../../scripts/autumn-release-preflight-core';
import { prepareGardenPackIntegrationSchema } from './gardenPackIntegrationSchema';

before(prepareGardenPackIntegrationSchema);
after(closeStorage);
const actor = {
    id: 'autumn-publication-test',
    name: 'Disposable integration only',
};
const read = repositoryReader(
    fileURLToPath(new URL('../../../../', import.meta.url)),
);
async function fixture() {
    const cms = await publicationFixtureCms();
    await storage().delete(entityRevisions);
    await storage().delete(attributeValues);
    await storage().delete(entities);
    await storage().delete(attributeDefinitions);
    await storage()
        .insert(entityTypes)
        .values({ name: 'block', label: 'Block' })
        .onConflictDoNothing();
    for (const category of new Set(
        cms.definitions.map((definition) => definition.category),
    ))
        await storage()
            .insert(attributeDefinitionCategories)
            .values({
                name: category,
                label: category,
                entityTypeName: 'block',
            })
            .onConflictDoNothing();
    await storage()
        .insert(attributeDefinitions)
        .values(
            cms.definitions.map((definition) => ({
                ...definition,
                updatedAt: new Date(definition.updatedAt),
            })),
        );
    await storage()
        .insert(entities)
        .values(
            cms.entities.map((entity) => ({
                id: entity.id,
                entityTypeName: 'block',
                state: 'draft',
                parentId: null,
                createdAt: new Date(entity.createdAt),
                updatedAt: new Date(entity.updatedAt),
            })),
        );
    await storage()
        .insert(attributeValues)
        .values(
            cms.entities.flatMap((entity) =>
                entity.attributes.map((attribute) => ({
                    ...attribute,
                    entityId: entity.id,
                    entityTypeName: 'block',
                    updatedAt: new Date(attribute.updatedAt),
                })),
            ),
        );
    for (const table of [
        'entities',
        'attribute_definitions',
        'attribute_values',
    ])
        await storage().execute(
            sql.raw(
                `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT max(id) FROM ${table}), true)`,
            ),
        );
    const source = await publicationFixtureSource();
    const plan = createAutumnPublicationPlan(
        source,
        await exportAutumnPublicationCms(),
    );
    const proof = await verifyAutumnPublicationDeployment(plan, async (url) => {
        const asset = plan.deployedAssets.find(
            (asset) => asset.url === String(url),
        );
        assert.ok(asset);
        return new Response(await read(asset.path));
    });
    return { plan, proof, digest: publicationDigest(plan) };
}
async function apply(
    current: Awaited<ReturnType<typeof fixture>>,
    refresh: (ids: number[]) => Promise<void> = async () => {},
) {
    return applyAutumnPublicationPlan(
        current.plan,
        current.digest,
        current.proof,
        actor,
        { refresh },
    );
}
test('publishes all 24 atomically, records actor/preconditions, and exact retry preserves original date/history', async () => {
    const current = await fixture();
    const first = await apply(current);
    assert.equal(
        first.rows.filter((row) => row.status === 'published').length,
        24,
    );
    assert.equal(first.releaseReady, false);
    assert.equal(first.database, 'committed');
    const snapshot = await exportAutumnPublicationCms();
    const revisions = await storage().select().from(entityRevisions);
    assert.equal(revisions.length, 24);
    assert.ok(
        revisions.every(
            (revision) =>
                revision.actorId === actor.id &&
                revision.nextValue === current.digest,
        ),
    );
    const retry = await apply(current);
    assert.ok(retry.rows.every((row) => row.status === 'noop'));
    assert.deepEqual(await exportAutumnPublicationCms(), snapshot);
    assert.deepEqual(await storage().select().from(entityRevisions), revisions);
});
test('concurrent identical plans commit once and replay without duplicate audits', async () => {
    const current = await fixture();
    const results = await Promise.all([apply(current), apply(current)]);
    assert.equal(
        results
            .flatMap((result) => result.rows)
            .filter((row) => row.status === 'published').length,
        24,
    );
    assert.equal(
        results
            .flatMap((result) => result.rows)
            .filter((row) => row.status === 'noop').length,
        24,
    );
    assert.equal((await storage().select().from(entityRevisions)).length, 24);
});
test('stale actual price blocks the entire batch before any publication', async () => {
    const current = await fixture();
    const definition = current.plan.definitions.find(
        (definition) => definition.category === 'prices',
    );
    assert.ok(definition);
    await storage()
        .update(attributeValues)
        .set({ value: '999' })
        .where(
            and(
                eq(
                    attributeValues.entityId,
                    current.plan.operations[23].expected.id,
                ),
                eq(attributeValues.attributeDefinitionId, definition.id),
            ),
        );
    await assert.rejects(apply(current), /Stale publication content/);
    assert.ok(
        (await exportAutumnPublicationCms()).entities.every(
            (entity) => entity.state === 'draft',
        ),
    );
    assert.equal((await storage().select().from(entityRevisions)).length, 0);
});
test('duplicate selected names and unrelated revision changes block every row', async () => {
    let current = await fixture();
    const nameDefinition = current.plan.definitions.find(
        (definition) =>
            definition.category === 'information' && definition.name === 'name',
    );
    assert.ok(nameDefinition);
    const [duplicate] = await storage()
        .insert(entities)
        .values({ entityTypeName: 'block', state: 'draft' })
        .returning();
    await storage().insert(attributeValues).values({
        entityTypeName: 'block',
        entityId: duplicate.id,
        attributeDefinitionId: nameDefinition.id,
        value: current.plan.operations[0].name,
    });
    await assert.rejects(
        apply(current),
        /duplicate block identity|Stale\/duplicate/,
    );
    assert.equal((await storage().select().from(entityRevisions)).length, 0);
    current = await fixture();
    await storage().insert(entityRevisions).values({
        entityId: current.plan.operations[0].expected.id,
        entityTypeName: 'block',
        action: 'entity.updated',
    });
    await assert.rejects(apply(current), /Stale publication revision/);
    assert.ok(
        (await exportAutumnPublicationCms()).entities.every(
            (entity) => entity.state === 'draft',
        ),
    );
});
test('later-row database failure rolls back every earlier state and audit write', async () => {
    const current = await fixture();
    const lastId = current.plan.operations[23].expected.id;
    await storage().execute(
        sql.raw(
            `CREATE FUNCTION reject_autumn_revision() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_id = ${lastId} THEN RAISE EXCEPTION 'test revision failure'; END IF; RETURN NEW; END $$`,
        ),
    );
    await storage().execute(
        sql`CREATE TRIGGER reject_autumn_revision BEFORE INSERT ON entity_revisions FOR EACH ROW EXECUTE FUNCTION reject_autumn_revision()`,
    );
    try {
        await assert.rejects(apply(current));
        assert.ok(
            (await exportAutumnPublicationCms()).entities.every(
                (entity) => entity.state === 'draft',
            ),
        );
        assert.equal(
            (await storage().select().from(entityRevisions)).length,
            0,
        );
    } finally {
        await storage().execute(
            sql`DROP TRIGGER reject_autumn_revision ON entity_revisions`,
        );
        await storage().execute(sql`DROP FUNCTION reject_autumn_revision()`);
    }
});
test('postcommit refresh failure is explicit; same-plan noop retries refresh without new revisions', async () => {
    const current = await fixture();
    const failed = await apply(current, async () => {
        throw new Error('test cache failure');
    });
    assert.equal(failed.database, 'committed');
    assert.equal(failed.refreshStatus, 'pending');
    let ids: number[] = [];
    const repaired = await apply(current, async (input) => {
        ids = input;
    });
    assert.equal(ids.length, 24);
    assert.equal(repaired.refreshStatus, 'completed');
    assert.ok(repaired.rows.every((row) => row.status === 'noop'));
    assert.equal((await storage().select().from(entityRevisions)).length, 24);
});
test('unrelated legacy rows with retired definitions do not block selected publication', async () => {
    const current = await fixture();
    const [retired] = await storage()
        .insert(attributeDefinitions)
        .values({
            category: 'information',
            name: 'retired-test',
            label: 'Retired',
            entityTypeName: 'block',
            dataType: 'string',
            isDeleted: true,
        })
        .returning();
    const [legacy] = await storage()
        .insert(entities)
        .values({ entityTypeName: 'block', state: 'legacy-state' })
        .returning();
    await storage().insert(attributeValues).values({
        entityTypeName: 'block',
        entityId: legacy.id,
        attributeDefinitionId: retired.id,
        value: 'Unrelated',
    });
    const result = await apply(current);
    assert.equal(result.rows.length, 24);
    assert.ok(
        !(await exportAutumnPublicationCms()).entities.some(
            (entity) =>
                publicationAttributeMap(entity, current.plan.definitions).get(
                    'information.name',
                ) === 'Unrelated',
        ),
    );
});
test('uncommitted CMS edits are fenced on PostgreSQL; settled stale edits fail in either provider', async () => {
    const current = await fixture();
    const definition = current.plan.definitions.find(
        (definition) => definition.category === 'prices',
    );
    assert.ok(definition);
    if (process.env.GREDICE_TEST_DB_PROVIDER === 'postgres') {
        let signalLocked: () => void = () => {};
        let releaseEditor: () => void = () => {};
        const locked = new Promise<void>((resolve) => {
            signalLocked = resolve;
        });
        const released = new Promise<void>((resolve) => {
            releaseEditor = resolve;
        });
        const editor = storage().transaction(async (tx) => {
            await tx
                .update(attributeValues)
                .set({ value: '999' })
                .where(
                    and(
                        eq(
                            attributeValues.entityId,
                            current.plan.operations[0].expected.id,
                        ),
                        eq(
                            attributeValues.attributeDefinitionId,
                            definition.id,
                        ),
                    ),
                );
            signalLocked();
            await released;
        });
        await locked;
        try {
            await assert.rejects(apply(current)); // publisher's 2s lock_timeout, not an editor row lock shared by convention
            assert.equal(
                (await storage().select().from(entityRevisions)).length,
                0,
            );
        } finally {
            releaseEditor();
            await editor;
        }
    } else {
        // PGlite has one connection: prove the settled invariant without claiming
        // it models simultaneous independent CMS writers or lock contention.
        await storage()
            .update(attributeValues)
            .set({ value: '999' })
            .where(
                and(
                    eq(
                        attributeValues.entityId,
                        current.plan.operations[0].expected.id,
                    ),
                    eq(attributeValues.attributeDefinitionId, definition.id),
                ),
            );
    }
    await assert.rejects(apply(current), /Stale publication content/);
    assert.ok(
        (await exportAutumnPublicationCms()).entities.every(
            (entity) => entity.state === 'draft',
        ),
    );
    assert.equal((await storage().select().from(entityRevisions)).length, 0);
});
