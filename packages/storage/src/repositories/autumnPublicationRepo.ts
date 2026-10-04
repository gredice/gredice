import 'server-only';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
    bustCached,
    bustCachedByPrefixes,
    cacheKeys,
} from '../cache/directoriesCached';
import { bustEntityReadModelsForMutatedTypes } from '../cache/entityReadModelInvalidation';
import {
    assertVerifiedAutumnDeployment,
    type VerifiedAutumnDeployment,
    verifiedAutumnDeploymentObservations,
} from '../helpers/autumnPublicationDeployment';
import {
    type AutumnCmsExport,
    assertReviewedPublicationEntity,
    autumnPublicationNames,
    publicationAttributeMap,
    publicationContent,
    publicationDigest,
    publicationEntityDigest,
    sortedDefinitions,
    validateAutumnPublicationPlan,
    validatePublicationExport,
} from '../helpers/autumnPublicationPlan';
import {
    attributeDefinitions,
    attributeValues,
    entities,
    entityRevisions,
} from '../schema/cmsSchema';
import { storage } from '../storage';

type Database = ReturnType<typeof storage>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Raw CMS snapshot. Call within repeatable-read export or the locked apply transaction. */
async function readSnapshot(db: Transaction): Promise<AutumnCmsExport> {
    const definitions = await db
        .select({
            id: attributeDefinitions.id,
            category: attributeDefinitions.category,
            name: attributeDefinitions.name,
            label: attributeDefinitions.label,
            required: attributeDefinitions.required,
            defaultValue: attributeDefinitions.defaultValue,
            multiple: attributeDefinitions.multiple,
            dataType: attributeDefinitions.dataType,
            entityTypeName: attributeDefinitions.entityTypeName,
            unit: attributeDefinitions.unit,
            order: attributeDefinitions.order,
            display: attributeDefinitions.display,
            updatedAt: attributeDefinitions.updatedAt,
        })
        .from(attributeDefinitions)
        .where(
            and(
                eq(attributeDefinitions.entityTypeName, 'block'),
                eq(attributeDefinitions.isDeleted, false),
            ),
        )
        .limit(1_001);
    // Globally resolve only selected names. Unrelated legacy blocks may retain
    // values of retired definitions; they are not prerequisites for this batch.
    const named = await db
        .selectDistinctOn([entities.id], { entity: entities })
        .from(entities)
        .innerJoin(attributeValues, eq(attributeValues.entityId, entities.id))
        .innerJoin(
            attributeDefinitions,
            eq(attributeValues.attributeDefinitionId, attributeDefinitions.id),
        )
        .where(
            and(
                eq(entities.entityTypeName, 'block'),
                eq(entities.isDeleted, false),
                eq(attributeValues.isDeleted, false),
                eq(attributeDefinitions.isDeleted, false),
                eq(attributeDefinitions.entityTypeName, 'block'),
                eq(attributeDefinitions.category, 'information'),
                eq(attributeDefinitions.name, 'name'),
                inArray(attributeValues.value, autumnPublicationNames),
            ),
        )
        .orderBy(asc(entities.id))
        .limit(49);
    const rows = named.map((row) => row.entity);
    const values = rows.length
        ? await db
              .select()
              .from(attributeValues)
              .where(
                  and(
                      inArray(
                          attributeValues.entityId,
                          rows.map((row) => row.id),
                      ),
                      eq(attributeValues.isDeleted, false),
                  ),
              )
              .limit(100_001)
        : [];
    if (values.length > 100_000)
        throw new Error('CMS export attribute limit exceeded');
    const revisions = rows.length
        ? await db
              .selectDistinctOn([entityRevisions.entityId])
              .from(entityRevisions)
              .where(
                  inArray(
                      entityRevisions.entityId,
                      rows.map((row) => row.id),
                  ),
              )
              .orderBy(asc(entityRevisions.entityId), desc(entityRevisions.id))
        : [];
    return validatePublicationExport({
        schemaVersion: 1,
        definitions: definitions.map((definition) => ({
            ...definition,
            updatedAt: definition.updatedAt.toISOString(),
        })),
        entities: rows.map((row) => {
            const revision = revisions.find(
                (revision) => revision.entityId === row.id,
            );
            return {
                id: row.id,
                entityTypeName: row.entityTypeName,
                parentId: row.parentId,
                hierarchyOrder: row.hierarchyOrder,
                state: row.state,
                publishedAt: row.publishedAt?.toISOString() ?? null,
                createdAt: row.createdAt.toISOString(),
                updatedAt: row.updatedAt.toISOString(),
                latestRevision: revision
                    ? {
                          id: revision.id,
                          action: revision.action,
                          previousState: revision.previousState,
                          nextState: revision.nextState,
                          previousValue: revision.previousValue,
                          nextValue: revision.nextValue,
                      }
                    : null,
                attributes: values
                    .filter((value) => value.entityId === row.id)
                    .map((value) => ({
                        id: value.id,
                        attributeDefinitionId: value.attributeDefinitionId,
                        value: value.value,
                        order: value.order,
                        updatedAt: value.updatedAt.toISOString(),
                    })),
            };
        }),
    });
}
/** Explicit read-only command only; importing the offline planner never invokes this. */
export async function exportAutumnPublicationCms(db: Database = storage()) {
    return db.transaction(async (tx) => {
        await tx.execute(
            sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`,
        );
        await tx.execute(sql`SET LOCAL statement_timeout = '15s'`);
        return readSnapshot(tx);
    });
}
async function refreshPublished(ids: number[]) {
    await Promise.all([
        ...ids.map((id) => bustCached(cacheKeys.entity(id))),
        bustEntityReadModelsForMutatedTypes(['block']),
        bustCachedByPrefixes(['dashboard:admin:']),
    ]);
    // Surface search failures: the ordinary mutation wrapper deliberately catches them.
    const { refreshImpactedEntitySearchDocuments } = await import(
        './entitySearchRepo'
    );
    for (const id of ids) await refreshImpactedEntitySearchDocuments(id);
}

/** State-only atomic publication; never seeds attributes, prices, IDs or product config. */
export async function applyAutumnPublicationPlan(
    input: unknown,
    expectedPlanDigest: string,
    proof: VerifiedAutumnDeployment,
    actor: { id: string; name: string },
    options: { db?: Database; refresh?: (ids: number[]) => Promise<void> } = {},
) {
    const plan = validateAutumnPublicationPlan(input);
    const planDigest = publicationDigest(plan);
    if (
        planDigest !== expectedPlanDigest ||
        !actor.id.trim() ||
        !actor.name.trim() ||
        actor.id.length > 200 ||
        actor.name.length > 200
    )
        throw new Error(
            'Exact reviewed plan digest and explicit actor required',
        );
    assertVerifiedAutumnDeployment(plan, proof);
    const deployedByteObservations = verifiedAutumnDeploymentObservations(
        plan,
        proof,
    );
    const db = options.db ?? storage();
    const committed = await db.transaction(async (tx) => {
        const started = Date.now();
        const budget = () => {
            if (Date.now() - started > 30_000)
                throw new Error('Publication transaction budget exceeded');
        };
        await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
        await tx.execute(sql`SET LOCAL statement_timeout = '15s'`);
        // Existing generic CMS writers do not all lock their entity before inserting
        // attributes/names/revisions. Table locks also fence these phantom inserts.
        await tx.execute(
            sql`LOCK TABLE entities, attribute_values, attribute_definitions, entity_revisions IN SHARE ROW EXCLUSIVE MODE`,
        );
        assertVerifiedAutumnDeployment(plan, proof);
        const snapshot = await readSnapshot(tx);
        budget();
        if (
            publicationDigest(sortedDefinitions(snapshot.definitions)) !==
            plan.definitionsDigest
        )
            throw new Error(
                'Stale block definitions; rebuild publication plan',
            );
        const pending = [];
        for (const operation of plan.operations) {
            const matches = snapshot.entities.filter(
                (entity) =>
                    publicationAttributeMap(entity, snapshot.definitions).get(
                        'information.name',
                    ) === operation.name,
            );
            const current = matches[0];
            if (
                matches.length !== 1 ||
                !current ||
                current.id !== operation.expected.id
            )
                throw new Error(
                    `Stale/duplicate publication identity: ${operation.name}`,
                );
            assertReviewedPublicationEntity(
                current,
                snapshot.definitions,
                operation.reviewedAttributes,
            );
            if (
                publicationDigest(publicationContent(current)) !==
                operation.contentDigest
            )
                throw new Error(`Stale publication content: ${operation.name}`);
            const exactBefore =
                publicationEntityDigest(current) === operation.expectedDigest;
            const ownReplay =
                current.state === 'published' &&
                current.publishedAt !== null &&
                current.latestRevision?.action === 'entity.autumn_published' &&
                current.latestRevision.previousState === 'draft' &&
                current.latestRevision.nextState === 'published' &&
                current.latestRevision.previousValue ===
                    operation.expectedDigest &&
                current.latestRevision.nextValue === planDigest;
            if (!exactBefore && !ownReplay)
                throw new Error(
                    `Stale publication revision/state: ${operation.name}`,
                );
            pending.push({
                operation,
                current,
                changed: current.state === 'draft',
            });
        }
        // Validate all rows before the first write; later database failures roll back
        // state and audit inserts for the entire batch in this same transaction.
        for (const item of pending) {
            if (!item.changed) continue;
            budget();
            await tx
                .update(entities)
                .set({ state: 'published', publishedAt: new Date() })
                .where(eq(entities.id, item.current.id));
            await tx.insert(entityRevisions).values({
                entityId: item.current.id,
                entityTypeName: 'block',
                action: 'entity.autumn_published',
                actorId: actor.id,
                actorName: actor.name,
                previousState: 'draft',
                nextState: 'published',
                previousValue: item.operation.expectedDigest,
                nextValue: planDigest,
            });
        }
        budget();
        return pending.map((item) => ({
            id: item.current.id,
            name: item.operation.name,
            status: item.changed ? ('published' as const) : ('noop' as const),
        }));
    });
    let refreshStatus: 'completed' | 'pending' = 'completed';
    try {
        await (options.refresh ?? refreshPublished)(
            committed.map((row) => row.id),
        );
    } catch {
        refreshStatus = 'pending';
    }
    return {
        scope: plan.scope,
        planDigest,
        database: 'committed',
        rows: committed,
        refreshStatus,
        deployedByteObservations,
        releaseReady: false,
        remainingGates: [
            'runtime/UI deployment readback',
            'published public directory/cache readback',
            'sales-disabled product config review/install',
            'current CI',
            'physical-device/audio/thermal',
            'authorized live commerce',
        ],
    };
}
