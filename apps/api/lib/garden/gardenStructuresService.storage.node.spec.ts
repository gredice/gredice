import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { GardenStructureDocument } from '@gredice/js/gardenStructures';
import {
    createAccount,
    createGardenStructure as createGardenStructureRecord,
    earnSunflowersOnce,
    type GardenPlacementTransaction,
    getGardenPlacementSnapshot,
    getGardenStructure,
    getGardenStructureOperationReceipt,
    getSunflowers,
    listGardenStructures,
    lockAccountAndAssertNotDeleting,
    replaceGardenStructureDocument,
    resizeGardenStructureDocument,
    softDeleteGardenStructure,
    spendSunflowersBatch,
    updateGardenStructurePlacement,
    withGardenPlacementTransaction,
    withGardenStructureOperation,
    withSunflowerAccountTransaction,
} from '@gredice/storage';
import {
    createTestGarden,
    ensureFarmId,
} from '../../../../packages/storage/tests/helpers/testHelpers';
import {
    type CreateGardenStructureCommand,
    createGardenStructureApplicationService,
    type GardenStructureApplicationServiceDependencies,
    GardenStructureServiceError,
} from './gardenStructuresService';

const storageIntegrationEnabled =
    process.env.TEST_ENV === '1' && Boolean(process.env.POSTGRES_URL);

function twoCellDocument(): GardenStructureDocument {
    return {
        schemaVersion: 1,
        footprint: {
            cells: [
                { spaceKind: 'interior', x: 0, y: 0 },
                { spaceKind: 'interior', x: 1, y: 0 },
            ],
        },
        floors: [],
        edges: [],
        roofRegions: [],
        props: [],
    };
}

function integrationService(controls: { failAfterPricing: boolean }) {
    const dependencies: GardenStructureApplicationServiceDependencies<GardenPlacementTransaction> =
        {
            createStructure: (input, options) =>
                createGardenStructureRecord(input, {
                    ...options,
                    applyPricingEffect: async (effect, transaction) => {
                        await options.applyPricingEffect(effect, transaction);
                        if (controls.failAfterPricing) {
                            throw new Error(
                                'Injected failure after real pricing effect.',
                            );
                        }
                    },
                }),
            debitSunflowers: async (accountId, amount, reason, transaction) => {
                await spendSunflowersBatch(
                    accountId,
                    [{ amount, reason }],
                    transaction,
                );
            },
            deleteStructure: (input, options) =>
                softDeleteGardenStructure(input, options),
            getBlockData: async () => [],
            getGardenPlacementSnapshot: (gardenId, transaction) =>
                getGardenPlacementSnapshot(gardenId, transaction),
            getStructure: (input, transaction) =>
                getGardenStructure(input, transaction),
            isEnabled: () => true,
            isCommercialEnabled: () => true,
            listStructures: (gardenId, transaction) =>
                listGardenStructures(gardenId, transaction),
            lockAccountAndAssertNotDeleting: async (accountId, transaction) =>
                Boolean(
                    await lockAccountAndAssertNotDeleting(
                        accountId,
                        transaction,
                    ),
                ),
            refundSunflowers: async (
                accountId,
                amount,
                reason,
                transaction,
            ) => {
                await earnSunflowersOnce(
                    accountId,
                    amount,
                    reason,
                    transaction,
                );
            },
            replaceStructure: (input, transaction) =>
                replaceGardenStructureDocument(input, transaction),
            resizeStructure: (input, options) =>
                resizeGardenStructureDocument(input, options),
            updateStructurePlacement: (input, transaction) =>
                updateGardenStructurePlacement(input, transaction),
            validateStructureCandidate: () => ({
                supportHeight: 0,
                valid: true,
                worldFootprint: [],
            }),
            withGardenPlacementTransaction: (gardenId, callback, transaction) =>
                withGardenPlacementTransaction(gardenId, callback, transaction),
            withOperation: (input, callback, transaction) =>
                withGardenStructureOperation(input, callback, transaction),
            withSunflowerAccountTransaction: (accountId, callback) =>
                withSunflowerAccountTransaction(accountId, callback),
        };
    return createGardenStructureApplicationService(dependencies);
}

test('real nested transaction rolls back a pricing effect and replays a committed receipt exactly', {
    skip: !storageIntegrationEnabled,
}, async () => {
    const accountId = await createAccount();
    const farmId = await ensureFarmId();
    const gardenId = await createTestGarden({ accountId, farmId });
    const structureId = randomUUID();
    const operationId = randomUUID();
    const controls = { failAfterPricing: true };
    const service = integrationService(controls);
    const command: CreateGardenStructureCommand = {
        accountId,
        anchorX: 0,
        anchorY: 0,
        document: twoCellDocument(),
        gardenId,
        kitKey: 'gredice-buildings',
        kitVersion: '1',
        operationId,
        rotation: 0,
        structureId,
        templateKey: 'blank',
    };
    const initialBalance = await getSunflowers(accountId);

    await assert.rejects(service.create(command), (error: unknown) => {
        if (!(error instanceof GardenStructureServiceError)) return false;
        assert.equal(error.code, 'OPERATION_FAILED');
        assert.equal(error.status, 503);
        return true;
    });
    assert.equal(await getSunflowers(accountId), initialBalance);
    assert.equal(
        await getGardenStructure({
            gardenId,
            includeDeleted: true,
            structureId,
        }),
        null,
    );
    assert.equal(
        await getGardenStructureOperationReceipt({
            gardenId,
            operationId,
        }),
        null,
    );

    controls.failAfterPricing = false;
    const first = await service.create(command);
    const balanceAfterCreate = await getSunflowers(accountId);
    assert.equal(balanceAfterCreate, initialBalance - 100);

    const replay = await service.create(command);
    assert.deepEqual(replay, first);
    assert.equal(await getSunflowers(accountId), balanceAfterCreate);
    assert.equal(
        (
            await getGardenStructureOperationReceipt({
                gardenId,
                operationId,
            })
        )?.resultRevision,
        first.structure.revision,
    );
});
