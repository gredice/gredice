import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import {
    type AutomationDefinitionInput,
    automationDefinitions,
    automationEventCursors,
    automationRunSteps,
    automationRuns,
    enqueueAutomationRunsFromDomainEvents,
    enqueueAutomationRunsFromSchedules,
    ensureDefaultAutomationDefinitions,
    getAutomationDefinitionByKey,
    runAutomations,
    seasonalSowedWateringAutomationGraph,
    storage,
    syncManagedAutomationDefinitions,
    updateAutomationDefinition,
} from '@gredice/storage';
import { sql } from 'drizzle-orm';
import { createTestDb } from './testDb';

afterEach(async () => {
    await storage().execute(
        sql`drop trigger if exists managed_sync_audit on automation_definitions`,
    );
    await storage().execute(sql`drop function if exists managed_sync_audit()`);
    await storage().execute(sql`drop table if exists managed_sync_audit`);
    await storage().delete(automationRunSteps);
    await storage().delete(automationRuns);
    await storage().delete(automationDefinitions);
    await storage().delete(automationEventCursors);
});

async function auditDefinitionWrites() {
    await storage().execute(
        sql`create table managed_sync_audit (operation text not null)`,
    );
    await storage().execute(sql`
        create function managed_sync_audit() returns trigger language plpgsql as $$
        begin
            insert into managed_sync_audit values (TG_OP);
            return new;
        end;
        $$
    `);
    await storage().execute(sql`
        create trigger managed_sync_audit after insert or update on automation_definitions
        for each row execute function managed_sync_audit()
    `);
}

async function definitionWriteCounts() {
    const result = await storage().execute<{
        inserts: number;
        updates: number;
    }>(sql`
        select count(*) filter (where operation = 'INSERT')::int as inserts,
               count(*) filter (where operation = 'UPDATE')::int as updates
        from managed_sync_audit
    `);
    return result.rows[0];
}

test('idle schedule, event and combined scans leave managed definitions untouched', async () => {
    createTestDb();
    await auditDefinitionWrites();
    const initialized = await ensureDefaultAutomationDefinitions();
    assert.strictEqual(initialized.changedDefinitions, 13);
    assert.deepStrictEqual(await definitionWriteCounts(), {
        inserts: 13,
        updates: 0,
    });
    const before = await storage().select().from(automationDefinitions);

    for (let index = 0; index < 3; index += 1) {
        await enqueueAutomationRunsFromSchedules({ limit: 0 });
        await enqueueAutomationRunsFromDomainEvents({ limit: 0 });
        await runAutomations({
            scheduleBatchLimit: 0,
            eventBatchLimit: 0,
            runBatchLimit: 0,
        });
    }

    assert.strictEqual(
        (await ensureDefaultAutomationDefinitions()).changedDefinitions,
        0,
    );
    assert.deepStrictEqual(await definitionWriteCounts(), {
        inserts: 13,
        updates: 0,
    });
    assert.deepStrictEqual(
        await storage().select().from(automationDefinitions),
        before,
    );
    for (const reference of Object.values(initialized)) {
        if (typeof reference === 'object') {
            assert.deepStrictEqual(Object.keys(reference).sort(), [
                'id',
                'key',
            ]);
        }
    }
});

test('concurrent workers install missing defaults only once', async () => {
    createTestDb();
    await auditDefinitionWrites();
    const results = await Promise.all(
        Array.from({ length: 5 }, () => ensureDefaultAutomationDefinitions()),
    );
    assert.strictEqual(
        results.reduce((count, result) => count + result.changedDefinitions, 0),
        13,
    );
    assert.deepStrictEqual(await definitionWriteCounts(), {
        inserts: 13,
        updates: 0,
    });
    assert.strictEqual(
        (await storage().select().from(automationDefinitions)).length,
        13,
    );
    assert.ok(
        results.every(
            (result) =>
                result.farmRaisedBedWeeding.id ===
                results[0]?.farmRaisedBedWeeding.id,
        ),
    );
});

test('a changed source revision applies once and preserves supported admin settings', async () => {
    createTestDb();
    await auditDefinitionWrites();
    const managed: AutomationDefinitionInput = {
        key: 'managed.sync-revision',
        name: 'Managed revision',
        status: 'draft',
        preserveExistingStatus: true,
        graph: seasonalSowedWateringAutomationGraph(),
        metadata: { managedBy: 'gredice' },
    };
    const stable = { ...managed, key: 'managed.sync-unchanged' };
    await syncManagedAutomationDefinitions([managed, stable]);
    const definition = await getAutomationDefinitionByKey(managed.key);
    assert.ok(definition);
    assert.match(String(definition.metadata.managedRevision), /^[a-f0-9]{64}$/);
    const editedGraph = {
        ...definition.graph,
        nodes: definition.graph.nodes.map((node) => ({
            ...node,
            position: { x: 200, y: 300 },
        })),
    };
    await updateAutomationDefinition(definition.id, {
        status: 'enabled',
        maxConcurrentRuns: 4,
        graph: editedGraph,
    });
    assert.strictEqual(
        (await syncManagedAutomationDefinitions([managed, stable]))
            .changedDefinitions,
        0,
    );
    assert.deepStrictEqual(
        (await getAutomationDefinitionByKey(managed.key))?.graph,
        editedGraph,
    );
    const unchangedBefore = await getAutomationDefinitionByKey(stable.key);
    const changed = { ...managed, name: 'Managed revision changed' };
    const results = await Promise.all(
        Array.from({ length: 5 }, () =>
            syncManagedAutomationDefinitions([changed, stable]),
        ),
    );

    assert.strictEqual(
        results.reduce((count, result) => count + result.changedDefinitions, 0),
        1,
    );
    assert.deepStrictEqual(await definitionWriteCounts(), {
        inserts: 2,
        updates: 2,
    });
    const updated = await getAutomationDefinitionByKey(managed.key);
    assert.ok(updated);
    assert.strictEqual(updated.name, changed.name);
    assert.strictEqual(updated.status, 'enabled');
    assert.strictEqual(updated.maxConcurrentRuns, 4);
    assert.deepStrictEqual(updated.graph, managed.graph);
    assert.notStrictEqual(
        updated.metadata.managedRevision,
        definition.metadata.managedRevision,
    );
    assert.deepStrictEqual(
        await getAutomationDefinitionByKey(stable.key),
        unchangedBefore,
    );
});

test('failed initialization rolls back and retries without caching success', async () => {
    createTestDb();
    await storage().execute(sql`
        create function managed_sync_audit() returns trigger language plpgsql as $$
        begin
            if new.key = 'managed.b-fails' then
                raise exception 'managed initialization test failure';
            end if;
            return new;
        end;
        $$
    `);
    await storage().execute(sql`
        create trigger managed_sync_audit before insert on automation_definitions
        for each row execute function managed_sync_audit()
    `);
    const definitions = ['managed.a-first', 'managed.b-fails'].map((key) => ({
        key,
        name: key,
    }));
    await assert.rejects(syncManagedAutomationDefinitions(definitions));
    assert.deepStrictEqual(
        await storage().select().from(automationDefinitions),
        [],
    );
    await storage().execute(
        sql`drop trigger managed_sync_audit on automation_definitions`,
    );
    const retry = await syncManagedAutomationDefinitions(definitions);
    assert.strictEqual(retry.changedDefinitions, 2);
    assert.strictEqual(
        (await syncManagedAutomationDefinitions(definitions))
            .changedDefinitions,
        0,
    );
});

test('missing and legacy definitions recover without rewriting current definitions', async () => {
    createTestDb();
    await ensureDefaultAutomationDefinitions();
    const before = await storage().select().from(automationDefinitions);
    const [missing, legacy] = before;
    assert.ok(missing);
    assert.ok(legacy);
    await storage().execute(
        sql`delete from automation_definitions where id = ${missing.id}`,
    );
    await storage().execute(
        sql`update automation_definitions set metadata = metadata - 'managedRevision' where id = ${legacy.id}`,
    );
    await auditDefinitionWrites();

    assert.strictEqual(
        (await ensureDefaultAutomationDefinitions()).changedDefinitions,
        2,
    );
    assert.deepStrictEqual(await definitionWriteCounts(), {
        inserts: 1,
        updates: 1,
    });
    const recovered = await storage().select().from(automationDefinitions);
    assert.strictEqual(recovered.length, 13);
    for (const definition of before.slice(2)) {
        assert.deepStrictEqual(
            recovered.find((row) => row.id === definition.id),
            definition,
        );
    }
});
