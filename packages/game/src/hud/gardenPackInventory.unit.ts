import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOwnedGardenPackFixture } from '../../tests/ownedGardenPackFixture';
import { getLocalSandboxBlockData } from '../localSandboxBlockData';
import { normalizeBackpackTab } from '../useUrlState';
import {
    canQueryGardenPackInventory,
    getOwnedPackLineBlock,
    getOwnedPackNextUnit,
    getOwnedPackStateLabel,
    getOwnedPackVariantLabel,
} from './ownedGardenPackInventory';

test('pack queries require rollout, authenticated account and an ordinary garden', () => {
    const context = {
        rolloutEnabled: true,
        authenticatedQueriesEnabled: true,
        isMock: false,
        isLocalSandbox: false,
        isSandbox: false,
        userId: 'user-one',
        accountId: 'account-one',
    };
    assert.equal(canQueryGardenPackInventory(context), true);
    for (const disabled of [
        { rolloutEnabled: false },
        { authenticatedQueriesEnabled: false },
        { isMock: true },
        { isLocalSandbox: true },
        { isSandbox: true },
        { isSandbox: undefined },
        { userId: undefined },
        { accountId: undefined },
    ])
        assert.equal(
            canQueryGardenPackInventory({ ...context, ...disabled }),
            false,
        );
});

test('owned state follows remaining units and never sale dates', () => {
    assert.equal(
        getOwnedPackStateLabel({ remainingQuantity: 3, totalQuantity: 3 }),
        'Neotvoren',
    );
    assert.equal(
        getOwnedPackStateLabel({ remainingQuantity: 2, totalQuantity: 3 }),
        'Djelomično iskorišten',
    );
    assert.equal(
        getOwnedPackStateLabel({ remainingQuantity: 0, totalQuantity: 3 }),
        'Iskorišten',
    );
    assert.equal(normalizeBackpackTab('gardenPacks'), 'gardenPacks');
    assert.equal(normalizeBackpackTab('bad-tab'), 'backpack');
});

test('the next paid piece preserves purchase, line and exact variant identity without mutation', () => {
    const pack = createOwnedGardenPackFixture();
    const line = pack.lines[0];
    assert.ok(line);
    line.variant = {
        versionId: 'appearance-v1',
        appearance: { color: 'orange', accessory: 'ribbon' },
    };
    const before = structuredClone(pack);
    const unit = getOwnedPackNextUnit(pack, line);
    assert.deepEqual(unit, {
        purchaseId: pack.purchaseId,
        lineId: line.lineId,
        unitOrdinal: 2,
        entityId: '801',
        modelName: line.modelName,
        variant: line.variant,
    });
    assert.deepEqual(pack, before);
    const repeat = { ...pack, purchaseId: 'purchase-two' };
    assert.equal(
        getOwnedPackNextUnit(repeat, line)?.purchaseId,
        'purchase-two',
    );
    assert.equal(
        getOwnedPackVariantLabel(line),
        'Kupljeni izgled trenutačno nije dostupan.',
    );
    assert.equal(
        getOwnedPackVariantLabel({
            ...line,
            modelName: 'HorseStable',
            variant: {
                versionId: 'entity-appearance:v1',
                appearance: { id: 'bay' },
            },
        }),
        'Dorat',
    );
});

test('exhausted or inconsistent quantities cannot begin placement', () => {
    const pack = createOwnedGardenPackFixture();
    const line = pack.lines[0];
    assert.ok(line);
    for (const invalid of [
        { remainingQuantity: 0 },
        { availableUnitOrdinals: [2] },
        { availableUnitOrdinals: [2, 2] },
        { availableUnitOrdinals: [0, 2] },
        { availableUnitOrdinals: [2, 4] },
        { availableUnitOrdinals: [2, 2.5] },
    ])
        assert.equal(
            getOwnedPackNextUnit(pack, { ...line, ...invalid }),
            undefined,
        );
});

test('owned supported models remain available at zero price; missing identities never substitute', () => {
    const pack = createOwnedGardenPackFixture();
    const line = pack.lines[0];
    assert.ok(line);
    const local = getLocalSandboxBlockData().find(
        (block) => block.information.name === line.modelName,
    );
    assert.ok(local);
    const block = {
        ...local,
        id: Number(line.entityId),
        prices: { ...local.prices, sunflowers: 0 },
    };
    assert.equal(getOwnedPackLineBlock(line, [block]), block);
    assert.equal(
        getOwnedPackLineBlock(
            {
                ...line,
                variant: {
                    versionId: 'unsupported-v1',
                    appearance: { id: 'unknown' },
                },
            },
            [block],
        ),
        undefined,
    );
    assert.equal(getOwnedPackLineBlock(line, []), undefined);
    assert.equal(
        getOwnedPackLineBlock(line, [{ ...block, id: 802 }]),
        undefined,
    );
    assert.equal(
        getOwnedPackLineBlock(line, [
            {
                ...block,
                information: { ...block.information, name: 'FallenLog' },
            },
        ]),
        undefined,
    );
    assert.equal(
        getOwnedPackLineBlock({ ...line, modelName: 'UnshippedModel' }, [
            {
                ...block,
                information: { ...block.information, name: 'UnshippedModel' },
            },
        ]),
        undefined,
    );
});
