import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const calls: string[] = [];
let authError: Error | undefined;
let entity: { entityTypeName: string } | undefined;
let upsertInput: unknown;

mock.module('@gredice/storage', {
    namedExports: {
        getAttributeDefinitions: async (entityTypeName: string) => {
            calls.push(`definitions:${entityTypeName}`);
            return [{ id: 7, name: 'name', dataType: 'string' }];
        },
        getEntityRaw: async (entityId: number) => {
            calls.push(`entity:${entityId}`);
            return entity;
        },
        upsertAttributeValue: async (input: unknown) => {
            calls.push('upsert');
            upsertInput = input;
        },
    },
});
mock.module('next/cache', {
    namedExports: {
        revalidatePath: (path: string) => calls.push(`revalidate:${path}`),
    },
});
mock.module('../../../../lib/auth/auth.ts', {
    namedExports: {
        auth: async (roles: string[]) => {
            calls.push('auth');
            assert.deepEqual(roles, ['admin']);
            if (authError) throw authError;
        },
    },
});
mock.module('../../../../lib/revalidation/publicDirectoryPages.ts', {
    namedExports: {
        revalidatePublicDirectoryPagesForEntityType: async (
            entityTypeName: string,
            reason: string,
        ) => calls.push(`public:${entityTypeName}:${reason}`),
    },
});

const { importEntityData } = await import('./importEntityData.ts');

function importForm(contents: string | Uint8Array) {
    const formData = new FormData();
    formData.set(
        'entityJson',
        new File([contents], 'entity.json', { type: 'application/json' }),
    );
    return formData;
}

test.beforeEach(() => {
    calls.length = 0;
    authError = undefined;
    entity = { entityTypeName: 'plant' };
    upsertInput = undefined;
});

test('rejects unauthorized callers before reading or writing entity data', async (t) => {
    const fileText = t.mock.method(File.prototype, 'text');
    authError = new Error('Unauthorized');

    await assert.rejects(
        importEntityData('plant', 42, importForm('{"name":"Basil"}')),
        authError,
    );
    assert.equal(fileText.mock.callCount(), 0);
    assert.deepEqual(calls, ['auth']);
});

test('rejects oversized imports before reading entity data', async (t) => {
    const fileText = t.mock.method(File.prototype, 'text');
    const oversizedImport = new Uint8Array(1024 * 1024 + 1);

    await assert.rejects(
        importEntityData('plant', 42, importForm(oversizedImport)),
        /Import file must not exceed 1 MB/,
    );
    assert.equal(fileText.mock.callCount(), 0);
    assert.deepEqual(calls, ['auth']);
});

test('rejects an entity type that does not own the requested entity', async () => {
    entity = { entityTypeName: 'seed' };

    await assert.rejects(
        importEntityData('plant', 42, importForm('{"name":"Basil"}')),
        /Entity type does not match the requested entity/,
    );
    assert.deepEqual(calls, ['auth', 'entity:42']);
});

test('imports valid JSON for an authorized matching entity', async () => {
    const result = await importEntityData(
        'plant',
        42,
        importForm('{"name":"Basil"}'),
    );

    assert.deepEqual(upsertInput, {
        entityId: 42,
        entityTypeName: 'plant',
        attributeDefinitionId: 7,
        value: 'Basil',
        order: '0',
    });
    assert.deepEqual(calls, [
        'auth',
        'entity:42',
        'definitions:plant',
        'upsert',
        'revalidate:/admin/directories/plant/42',
        'revalidate:/admin/directories/plant',
        'public:plant:entity.import',
    ]);
    assert.deepEqual(result, { success: true });
});
