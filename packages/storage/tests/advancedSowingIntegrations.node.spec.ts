import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';
import { getAchievementDefinition } from '@gredice/js/achievements';
import {
    type AutomationJsonObject,
    type AutomationSourceEvent,
    assignSelectedRaisedBedPlantingTask,
    attributeDefinitions,
    automationDefinitions,
    automationModuleKeys,
    automationRuns,
    completeSelectedRaisedBedPlantingTask,
    createAttributeDefinition,
    createAutomationDefinition,
    createAutomationRun,
    createEntity,
    createOperation,
    createRaisedBedPlanting,
    createSelectedPlantStatusAutomationApprovalRequest,
    entities,
    evaluateAchievements,
    events,
    farms,
    getAccountAchievements,
    getAllEvents,
    getApprovalRequests,
    getAutomationModule,
    getCheckoutOperationMapping,
    getOperationById,
    getOperations,
    getOrCreateCheckoutOperation,
    getRaisedBed,
    getRaisedBedPlanting,
    getSelectedPlantingDiaryEntries,
    knownEventTypes,
    raisedBedPlantings,
    raisedBeds,
    storage,
    updateEntity,
    updateSelectedRaisedBedPlantingLifecycleStatus,
    upsertAttributeValue,
    upsertEntityType,
    verifySelectedRaisedBedPlantingTask,
} from '@gredice/storage';
import { and, desc, eq, gt, inArray } from 'drizzle-orm';
import { buildSelectedPlantingApprovalTasks } from '../../../apps/app/src/selectedPlantingApprovalTasks';
import { filterAcceptedProposals } from '../src/automations/raisedBedImagePlantStatusAnalysis';
import { closeStorage } from '../src/storage';
import { createSelectedTaskFixture } from './helpers/selectedPlantingFixture';
import { createTestDb } from './testDb';

const fixtures: Awaited<ReturnType<typeof createSelectedTaskFixture>>[] = [];
const definitionIds: number[] = [];
const attributeDefinitionIds: number[] = [];
const operationEntityIds: number[] = [];
let initialEventId = 0;
let disposableFixtureInitialized = false;
before(async () => {
    createTestDb();
    initialEventId =
        (await storage().query.events.findFirst({ orderBy: desc(events.id) }))
            ?.id ?? 0;
    disposableFixtureInitialized = true;
});
async function integrationFixture(
    options: Parameters<typeof createSelectedTaskFixture>[0] = {},
) {
    const fixture = await createSelectedTaskFixture(options);
    fixtures.push(fixture);
    return fixture;
}
after(async () => {
    if (!disposableFixtureInitialized) return;
    // Specs share the disposable DB. Retire this spec's farms and runs so they
    // cannot be picked up by later global automation tests.
    await storage().delete(events).where(gt(events.id, initialEventId));
    if (attributeDefinitionIds.length)
        await storage()
            .update(attributeDefinitions)
            .set({ isDeleted: true })
            .where(inArray(attributeDefinitions.id, attributeDefinitionIds));
    const entityIds = [
        ...operationEntityIds,
        ...fixtures.map((fixture) => fixture.plantSortId),
    ];
    if (entityIds.length)
        await storage()
            .update(entities)
            .set({ isDeleted: true })
            .where(inArray(entities.id, entityIds));
    if (fixtures.length) {
        await storage()
            .update(raisedBedPlantings)
            .set({ isDeleted: true, isActive: false })
            .where(
                inArray(
                    raisedBedPlantings.raisedBedId,
                    fixtures.map((fixture) => fixture.raisedBedId),
                ),
            );
        await storage()
            .update(raisedBeds)
            .set({ isDeleted: true })
            .where(
                inArray(
                    raisedBeds.id,
                    fixtures.map((fixture) => fixture.raisedBedId),
                ),
            );
        await storage()
            .update(farms)
            .set({ isDeleted: true })
            .where(
                inArray(
                    farms.id,
                    fixtures.map((fixture) => fixture.farmId),
                ),
            );
    }
    if (definitionIds.length) {
        await storage()
            .update(automationRuns)
            .set({ status: 'succeeded' })
            .where(
                inArray(automationRuns.automationDefinitionId, definitionIds),
            );
        await storage()
            .update(automationDefinitions)
            .set({ status: 'disabled' })
            .where(inArray(automationDefinitions.id, definitionIds));
    }
    await closeStorage();
});

async function sowed(
    options: Parameters<typeof createSelectedTaskFixture>[0] = {},
) {
    const f = await integrationFixture(options);
    const result = await completeSelectedRaisedBedPlantingTask({
        ...f.task.identity,
        actor: { role: 'admin', userId: f.adminId },
        commandId: randomUUID(),
    });
    return { ...f, task: result.task };
}

async function companion(f: Awaited<ReturnType<typeof sowed>>) {
    const result = await createRaisedBedPlanting({
        ...f.plantingInput,
        eventAggregateId: `selected:${randomUUID()}`,
        selectedSeedingDistanceCm: 30,
        plantsPerAxis: 1,
        plantCount: 1,
        layoutKey: 'v1:fields:1x1:plants:1x1',
        spanRows: 1,
        spanColumns: 1,
        memberships: [
            {
                ...f.plantingInput.memberships[0],
                relativeRow: 0,
                relativeColumn: 0,
            },
        ],
        lifecycleStarted: {
            ...f.plantingInput.lifecycleStarted,
            commandId: randomUUID(),
            purchase: {
                ...f.plantingInput.lifecycleStarted.purchase,
                cartItemId:
                    f.plantingInput.lifecycleStarted.purchase.cartItemId + 1,
            },
        },
    });
    assert.ok(result.planting.selectedTask);
    return completeSelectedRaisedBedPlantingTask({
        ...result.planting.selectedTask.identity,
        actor: { role: 'admin', userId: f.adminId },
        commandId: randomUUID(),
    });
}

async function operationDefinition() {
    await upsertEntityType({ name: 'operation', label: 'Radnja' });
    const existing = await storage().query.attributeDefinitions.findFirst({
        where: and(
            eq(attributeDefinitions.entityTypeName, 'operation'),
            eq(attributeDefinitions.category, 'attributes'),
            eq(attributeDefinitions.name, 'application'),
            eq(attributeDefinitions.isDeleted, false),
        ),
    });
    const definition =
        existing?.id ??
        (await createAttributeDefinition({
            category: 'attributes',
            name: 'application',
            label: 'Primjena',
            entityTypeName: 'operation',
            dataType: 'text',
        }));
    if (!existing) attributeDefinitionIds.push(definition);
    const entityId = await createEntity('operation');
    operationEntityIds.push(entityId);
    await upsertAttributeValue({
        attributeDefinitionId: definition,
        entityTypeName: 'operation',
        entityId,
        value: 'plant',
    });
    await updateEntity({ id: entityId, state: 'published' });
    return entityId;
}

async function action(
    key: string,
    config: AutomationJsonObject,
    options: { event?: AutomationSourceEvent; dryRun?: boolean } = {},
) {
    const node = {
        id: 'action',
        kind: 'action' as const,
        moduleKey: key,
        position: { x: 1, y: 1 },
        config,
    };
    const graph = {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger' as const,
                moduleKey: automationModuleKeys.triggerDomainEvent,
                position: { x: 0, y: 0 },
                config: { eventType: 'test' },
            },
            node,
        ],
        edges: [{ id: 'edge', source: 'trigger', target: 'action' }],
    };
    const definition = await createAutomationDefinition({
        key: `test.selected:${randomUUID()}`,
        name: 'Selected integration',
        status: 'enabled',
        graph,
    });
    definitionIds.push(definition.id);
    const run = await createAutomationRun({
        automationDefinition: definition,
        source: 'manual',
        input: {
            occurrenceDate: '2026-09-14',
            enqueuedAt: new Date().toISOString(),
        },
    });
    const module = getAutomationModule(key);
    assert.ok(run);
    assert.ok(module);
    return module.execute(
        {
            run,
            graph,
            dryRun: options.dryRun ?? false,
            event: options.event,
            values: new Map(),
        },
        node,
    );
}

test('approval queue includes one multi-field sowing submission and verification removes it', async () => {
    const f = await integrationFixture({ multiField: true });
    const assigned = await assignSelectedRaisedBedPlantingTask({
        ...f.task.identity,
        actor: { role: 'admin', userId: f.adminId },
        assignedUserIds: [f.farmerId],
        commandId: randomUUID(),
    });
    const completed = await completeSelectedRaisedBedPlantingTask({
        ...assigned.task.identity,
        actor: { role: 'farmer', userId: f.farmerId },
        commandId: randomUUID(),
    });
    const bed = await getRaisedBed(f.raisedBedId);
    assert.ok(bed);
    const tasks = buildSelectedPlantingApprovalTasks([bed]);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].kind, 'selectedPlantingVerification');
    assert.deepEqual(tasks[0].identity, completed.task.identity);
    assert.equal(tasks[0].description, 'Polja 14, 15, 17, 18');
    await verifySelectedRaisedBedPlantingTask({
        ...tasks[0].identity,
        actor: { role: 'admin', userId: f.adminId },
        commandId: randomUUID(),
    });
    const verifiedBed = await getRaisedBed(f.raisedBedId);
    assert.ok(verifiedBed);
    assert.deepEqual(buildSelectedPlantingApprovalTasks([verifiedBed]), []);
});

test('greenhouse watering includes an advanced-only farm once for a multi-field planting', async () => {
    const f = await sowed({ multiField: true, sowingLocation: 'greenhouse' });
    const result = await action(
        automationModuleKeys.actionCreateGreenhouseSeedlingWateringOperations,
        {
            entityId: await operationDefinition(),
            entityTypeName: 'operation',
            scheduledInDays: 0,
        },
        { dryRun: true },
    );
    assert.equal(result.status, 'succeeded');
    const eligible = result.output?.eligibleFarms;
    assert.ok(Array.isArray(eligible));
    const farm = eligible.find(
        (entry) =>
            typeof entry === 'object' &&
            entry !== null &&
            'farmId' in entry &&
            entry.farmId === f.farmId,
    );
    assert.ok(farm && typeof farm === 'object' && !Array.isArray(farm));
    assert.equal(farm.greenhouseFieldCount, 1);
});

test('selected sowing queues seasonal care once and ignores pending farmer evidence', async () => {
    const f = await sowed({ multiField: true });
    const [event] = await getAllEvents(
        knownEventTypes.raisedBedPlantings.taskCompleted,
        [f.aggregateId],
    );
    assert.ok(event);
    const source = {
        id: event.id,
        aggregateId: event.aggregateId,
        type: event.type,
        data: { status: 'sowed' },
        createdAt: new Date('2026-09-14T08:00:00Z'),
    };
    const first = await action(
        automationModuleKeys.actionQueueSeasonalSowingOfferOperations,
        {},
        { event: source },
    );
    assert.equal(first.status, 'succeeded');
    const operations = await getOperations(
        f.accountId,
        undefined,
        f.raisedBedId,
    );
    assert.equal(operations.length, 3);
    await action(
        automationModuleKeys.actionQueueSeasonalSowingOfferOperations,
        {},
        { event: source },
    );
    assert.equal(
        (await getOperations(f.accountId, undefined, f.raisedBedId)).length,
        3,
    );
    const skipped = await action(
        automationModuleKeys.actionQueueSeasonalSowingOfferOperations,
        {},
        { event: { ...source, data: { status: 'pendingVerification' } } },
    );
    assert.equal(skipped.status, 'skipped');
});

test('image proposals resolve exact co-plants, deduplicate footprints and reject ambiguous or stale observations', async () => {
    const f = await sowed({ multiField: true });
    const other = await companion(f);
    const bed = await getRaisedBed(f.raisedBedId);
    assert.ok(bed);
    const proposal = {
        plantingId: f.plantingId,
        positionLabel: 18,
        requestedStatus: 'sprouted' as const,
        confidence: 0.99,
        evidence: 'Vidljive klice.',
        observedPlantCount: 1,
    };
    const output = {
        summary: '',
        weedProposals: [],
        proposals: [
            proposal,
            { ...proposal, positionLabel: 17 },
            { ...proposal, plantingId: other.task.identity.plantingId },
            { ...proposal, plantingId: null },
            { ...proposal, plantingId: 999999 },
        ],
    };
    const result = filterAcceptedProposals({
        output,
        raisedBed: bed,
        minConfidence: 0.9,
        referenceDate: new Date(),
    });
    assert.equal(result.accepted.length, 2);
    assert.equal(result.skipped.length, 3);
    assert.equal(
        filterAcceptedProposals({
            output,
            raisedBed: bed,
            minConfidence: 0.9,
            referenceDate: new Date('2020-01-01'),
        }).accepted.length,
        0,
    );
    const request = await createSelectedPlantStatusAutomationApprovalRequest({
        ...f.task.identity,
        raisedBedId: f.raisedBedId,
        requestedStatus: 'sprouted',
        requestedBy: 'automation:raised-bed-image-status-review',
        effectiveAt: new Date(),
        note: proposal.evidence,
    });
    assert.equal(request.status, 'pending');
    assert.equal(
        (await getRaisedBedPlanting(f.plantingId))?.lifecycleStatus,
        'sowed',
    );
});

test('selected purchase preserves target on retry, rejects another plant and rolls back failed creation', async () => {
    const f = await sowed();
    const other = await companion(f);
    const entityId = await operationDefinition();
    const bed = await getRaisedBed(f.raisedBedId);
    assert.ok(bed?.gardenId);
    const input = {
        accountId: f.accountId,
        gardenId: bed.gardenId,
        raisedBedId: f.raisedBedId,
        plantingId: f.plantingId,
        entityId,
        entityTypeName: 'operation',
    };
    const options = {
        plantingTarget: f.task.identity,
        paymentCurrency: 'sunflower' as const,
        scheduledDate: new Date(),
        delivery: null,
    };
    const cartItemId =
        f.plantingInput.lifecycleStarted.purchase.cartItemId + 100;
    await assert.rejects(
        storage().transaction(async (tx) => {
            await getOrCreateCheckoutOperation(cartItemId, input, options, tx);
            throw new Error('rollback');
        }),
        /rollback/,
    );
    assert.equal(await getCheckoutOperationMapping(cartItemId), null);
    const created = await getOrCreateCheckoutOperation(
        cartItemId,
        input,
        options,
    );
    assert.equal(
        (await getOperationById(created.operationId)).plantingId,
        f.plantingId,
    );
    assert.equal(
        (await getOperationById(created.operationId)).raisedBedFieldId,
        null,
    );
    await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...f.task.identity,
        status: 'sprouted',
        commandId: randomUUID(),
        actor: { role: 'admin', userId: f.adminId },
    });
    assert.deepEqual(
        await getOrCreateCheckoutOperation(cartItemId, input, options),
        { operationId: created.operationId, created: false },
    );
    await assert.rejects(
        getOrCreateCheckoutOperation(
            cartItemId,
            { ...input, plantingId: other.task.identity.plantingId },
            { ...options, plantingTarget: other.task.identity },
        ),
        /target changed/,
    );
    await assert.rejects(
        getOrCreateCheckoutOperation(cartItemId + 1, input, options),
        /Sadnja se promijenila/,
    );
    await assert.rejects(
        getOrCreateCheckoutOperation(
            cartItemId + 2,
            { ...input, accountId: randomUUID() },
            options,
        ),
        /Sadnja se promijenila/,
    );
});

test('selected diary preserves lifecycle and exact operation history, excludes co-plants and rejects another owner', async () => {
    const f = await sowed({ multiField: true });
    await companion(f);
    await updateSelectedRaisedBedPlantingLifecycleStatus({
        ...f.task.identity,
        status: 'sprouted',
        commandId: randomUUID(),
        actor: { role: 'admin', userId: f.adminId },
    });
    const entries = await getSelectedPlantingDiaryEntries({
        plantingId: f.plantingId,
        raisedBedId: f.raisedBedId,
        owner: f.owner,
    });
    assert.equal(
        entries.filter((entry) => entry.name === 'Zatraženo sijanje biljke')
            .length,
        1,
    );
    assert.equal(entries.length, 3);
    assert.ok(entries.some((entry) => entry.name.includes('proklijala')));
    assert.equal(JSON.stringify(entries).includes(f.adminId), false);
    await assert.rejects(
        getSelectedPlantingDiaryEntries({
            plantingId: f.plantingId,
            raisedBedId: f.raisedBedId,
            owner: { ...f.owner, userId: f.outsiderId },
        }),
    );
});

test('achievements include verified selected sowing once and remain idempotent', async () => {
    const f = await sowed({ multiField: true });
    await evaluateAchievements();
    const plantingAwards = (await getAccountAchievements(f.accountId)).filter(
        (award) =>
            getAchievementDefinition(award.achievementKey)?.category ===
            'planting',
    );
    assert.equal(plantingAwards.length, 1);
    assert.equal(plantingAwards[0].progressValue, 1);
    await evaluateAchievements();
    assert.equal(
        (await getAccountAchievements(f.accountId)).filter(
            (award) =>
                getAchievementDefinition(award.achievementKey)?.category ===
                'planting',
        ).length,
        1,
    );
});

test('harvest automation proposes the exact selected planting once and leaves companion state unchanged', async () => {
    const f = await sowed({ multiField: true });
    const other = await companion(f);
    let identity = f.task.identity;
    for (const status of ['sprouted', 'ready'] as const) {
        const result = await updateSelectedRaisedBedPlantingLifecycleStatus({
            ...identity,
            status,
            actor: { role: 'admin', userId: f.adminId },
            commandId: randomUUID(),
        });
        identity = result.task.identity;
    }
    const bed = await getRaisedBed(f.raisedBedId);
    assert.ok(bed?.gardenId);
    const operationId = await createOperation({
        accountId: f.accountId,
        gardenId: bed.gardenId,
        raisedBedId: f.raisedBedId,
        plantingId: f.plantingId,
        entityId: await operationDefinition(),
        entityTypeName: 'operation',
    });
    const source = {
        id: 900000,
        type: knownEventTypes.operations.complete,
        aggregateId: String(operationId),
        data: {},
        createdAt: new Date(),
    };
    const config = {
        targetStatus: 'harvested',
        requestedBy: 'automation:harvest-operation-status-review',
    };
    const first = await action(
        automationModuleKeys.actionCreatePlantStatusApprovalRequests,
        config,
        { event: source },
    );
    assert.equal(first.status, 'succeeded');
    await action(
        automationModuleKeys.actionCreatePlantStatusApprovalRequests,
        config,
        { event: source },
    );
    const requests = (
        await getApprovalRequests({
            kind: 'raisedBedPlanting.plantStatus',
            status: 'pending',
        })
    ).filter(
        (request) =>
            request.target.kind === 'raisedBedPlanting.plantStatus' &&
            request.target.plantingId === f.plantingId,
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0].target.requestedStatus, 'harvested');
    assert.equal(
        (await getRaisedBedPlanting(f.plantingId))?.lifecycleStatus,
        'ready',
    );
    assert.equal(
        (await getRaisedBedPlanting(other.task.identity.plantingId))
            ?.lifecycleStatus,
        'sowed',
    );
    const stale = await action(
        automationModuleKeys.actionCreatePlantStatusApprovalRequests,
        config,
        { event: { ...source, createdAt: new Date('2020-01-01') } },
    );
    assert.equal(stale.status, 'skipped');
});

test('selected diary includes exact purchased operations and hides unverified completion evidence', async () => {
    const f = await sowed();
    const other = await companion(f);
    const bed = await getRaisedBed(f.raisedBedId);
    assert.ok(bed?.gardenId);
    const base = {
        accountId: f.accountId,
        gardenId: bed.gardenId,
        raisedBedId: f.raisedBedId,
        entityId: await operationDefinition(),
        entityTypeName: 'operation',
    };
    const ownOperation = await createOperation({
        ...base,
        plantingId: f.plantingId,
    });
    const otherOperation = await createOperation({
        ...base,
        plantingId: other.task.identity.plantingId,
    });
    const entries = await getSelectedPlantingDiaryEntries({
        plantingId: f.plantingId,
        raisedBedId: f.raisedBedId,
        owner: f.owner,
    });
    assert.ok(entries.some((entry) => entry.id === -ownOperation));
    assert.ok(entries.every((entry) => entry.id !== -otherOperation));

    const pending = await integrationFixture();
    const assigned = await assignSelectedRaisedBedPlantingTask({
        ...pending.task.identity,
        actor: { role: 'admin', userId: pending.adminId },
        assignedUserIds: [pending.farmerId],
        commandId: randomUUID(),
    });
    await completeSelectedRaisedBedPlantingTask({
        ...assigned.task.identity,
        actor: { role: 'farmer', userId: pending.farmerId },
        commandId: randomUUID(),
        imageUrls: ['https://example.com/evidence.jpg'],
    });
    const pendingDiary = await getSelectedPlantingDiaryEntries({
        plantingId: pending.plantingId,
        raisedBedId: pending.raisedBedId,
        owner: pending.owner,
    });
    assert.ok(pendingDiary.every((entry) => !entry.imageUrls.length));
    await evaluateAchievements();
    assert.equal(
        (await getAccountAchievements(pending.accountId)).filter(
            (award) =>
                getAchievementDefinition(award.achievementKey)?.category ===
                'planting',
        ).length,
        0,
    );
});
