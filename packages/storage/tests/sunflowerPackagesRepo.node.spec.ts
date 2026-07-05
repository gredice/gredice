import assert from 'node:assert/strict';
import test from 'node:test';
import {
    attributeDefinitions,
    attributeValues,
    getSunflowerPackageByCode,
    getSunflowerPackageEligibilityForAccount,
    getSunflowerPackages,
    SunflowerPackageAlreadyPurchasedError,
    seedSunflowerPackageCatalog,
    storage,
    sunflowerPackageEntityTypeName,
    topUpSunflowerPackage,
    upsertAttributeValue,
} from '@gredice/storage';
import { and, eq } from 'drizzle-orm';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

async function findPackageAttributeValueId({
    code,
    category,
    name,
}: {
    code: string;
    category: string;
    name: string;
}) {
    const codeDefinition = await storage().query.attributeDefinitions.findFirst(
        {
            where: and(
                eq(
                    attributeDefinitions.entityTypeName,
                    sunflowerPackageEntityTypeName,
                ),
                eq(attributeDefinitions.category, 'presentation'),
                eq(attributeDefinitions.name, 'code'),
                eq(attributeDefinitions.isDeleted, false),
            ),
        },
    );
    const targetDefinition =
        await storage().query.attributeDefinitions.findFirst({
            where: and(
                eq(
                    attributeDefinitions.entityTypeName,
                    sunflowerPackageEntityTypeName,
                ),
                eq(attributeDefinitions.category, category),
                eq(attributeDefinitions.name, name),
                eq(attributeDefinitions.isDeleted, false),
            ),
        });
    assert.ok(codeDefinition);
    assert.ok(targetDefinition);

    const codeValue = await storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.attributeDefinitionId, codeDefinition.id),
            eq(attributeValues.value, code),
            eq(attributeValues.isDeleted, false),
        ),
    });
    assert.ok(codeValue);

    const targetValue = await storage().query.attributeValues.findFirst({
        where: and(
            eq(attributeValues.attributeDefinitionId, targetDefinition.id),
            eq(attributeValues.entityId, codeValue.entityId),
            eq(attributeValues.isDeleted, false),
        ),
    });
    assert.ok(targetValue);

    return {
        id: targetValue.id,
        entityId: targetValue.entityId,
        definition: targetDefinition,
        value: targetValue.value,
    };
}

test('seedSunflowerPackageCatalog creates the five launch packages idempotently', async () => {
    createTestDb();

    const firstSeed = await seedSunflowerPackageCatalog();
    const secondSeed = await seedSunflowerPackageCatalog();
    const packages = await getSunflowerPackages();

    assert.equal(firstSeed.length, 5);
    assert.equal(secondSeed.length, 5);
    assert.deepEqual(
        packages.map((pkg) => pkg.code),
        [
            'puna_gredica',
            'mali_zalogaj',
            'vrtna_kosarica',
            'mirna_sezona',
            'majstor_vrtlar',
        ],
    );
    assert.equal(packages.filter((pkg) => pkg.role === 'main').length, 3);
    assert.equal(
        packages.find((pkg) => pkg.code === 'majstor_vrtlar')
            ?.upsellTriggerCode,
        'mirna_sezona',
    );
    assert.equal(
        packages.find((pkg) => pkg.code === 'vrtna_kosarica')?.priceCents,
        3999,
    );
    assert.equal(
        packages.find((pkg) => pkg.code === 'vrtna_kosarica')?.bonusSunflowers,
        2000,
    );
});

test('getSunflowerPackageByCode returns null for unknown or inactive customer package', async () => {
    createTestDb();
    await seedSunflowerPackageCatalog();

    assert.equal(await getSunflowerPackageByCode('missing'), null);
    const packageData = await getSunflowerPackageByCode('mali_zalogaj');
    assert.equal(packageData?.name, 'Mali zalogaj');
    assert.equal(packageData?.showInPrimaryList, true);
});

test('getSunflowerPackageEligibilityForAccount blocks one-time package after purchase', async () => {
    createTestDb();
    await seedSunflowerPackageCatalog();
    const accountId = await createTestAccount();

    const beforePurchase =
        await getSunflowerPackageEligibilityForAccount(accountId);
    assert.equal(
        beforePurchase.find((pkg) => pkg.code === 'puna_gredica')?.eligible,
        true,
    );

    await topUpSunflowerPackage({
        accountId,
        packageCode: 'puna_gredica',
        sunflowers: 60000,
        bonusSunflowers: 10000,
        priceCents: 4999,
        idempotencyKey: 'checkout-session-one-time-eligibility',
    });

    const afterPurchase =
        await getSunflowerPackageEligibilityForAccount(accountId);
    const packageData = afterPurchase.find(
        (pkg) => pkg.code === 'puna_gredica',
    );
    assert.equal(packageData?.eligible, false);
    assert.equal(packageData?.ineligibleReason, 'already_purchased');
});

test('topUpSunflowerPackage does not create a bonus on replay after a bonus-less top-up', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    const firstTopUp = await topUpSunflowerPackage({
        accountId,
        packageCode: 'mali_zalogaj',
        sunflowers: 5000,
        bonusSunflowers: 0,
        priceCents: 499,
        idempotencyKey: 'bonus-replay-guard',
    });
    assert.equal(firstTopUp.topUp.status, 'created');
    assert.equal(firstTopUp.bonus, null);

    await assert.rejects(
        () =>
            topUpSunflowerPackage({
                accountId,
                packageCode: 'mali_zalogaj',
                sunflowers: 6000,
                bonusSunflowers: 1000,
                priceCents: 499,
                idempotencyKey: 'bonus-replay-guard',
            }),
        /already exists without a matching bonus entry/,
    );

    const replay = await topUpSunflowerPackage({
        accountId,
        packageCode: 'mali_zalogaj',
        sunflowers: 5000,
        bonusSunflowers: 0,
        priceCents: 499,
        idempotencyKey: 'bonus-replay-guard',
    });
    assert.equal(replay.topUp.status, 'existing');
    assert.equal(replay.bonus, null);
});

test('topUpSunflowerPackage enforces one-time package purchases while preserving replay idempotency', async () => {
    createTestDb();
    await seedSunflowerPackageCatalog();
    const accountId = await createTestAccount();

    const firstTopUp = await topUpSunflowerPackage({
        accountId,
        packageCode: 'puna_gredica',
        sunflowers: 60000,
        bonusSunflowers: 10000,
        priceCents: 4999,
        idempotencyKey: 'checkout-session-one-time-first',
        enforceOneTime: true,
    });
    const replayTopUp = await topUpSunflowerPackage({
        accountId,
        packageCode: 'puna_gredica',
        sunflowers: 60000,
        bonusSunflowers: 10000,
        priceCents: 4999,
        idempotencyKey: 'checkout-session-one-time-first',
        enforceOneTime: true,
    });

    assert.equal(firstTopUp.topUp.status, 'created');
    assert.equal(replayTopUp.topUp.status, 'existing');
    await assert.rejects(
        () =>
            topUpSunflowerPackage({
                accountId,
                packageCode: 'puna_gredica',
                sunflowers: 60000,
                bonusSunflowers: 10000,
                priceCents: 4999,
                idempotencyKey: 'checkout-session-one-time-second',
                enforceOneTime: true,
            }),
        SunflowerPackageAlreadyPurchasedError,
    );
});

test('getSunflowerPackages rejects malformed numeric package data', async () => {
    createTestDb();
    await seedSunflowerPackageCatalog();
    const originalPriceValue = await findPackageAttributeValueId({
        code: 'mali_zalogaj',
        category: 'pricing',
        name: 'priceEur',
    });

    try {
        for (const value of ['not-a-number', '39.99 EUR', '49,99']) {
            const priceValue = await findPackageAttributeValueId({
                code: 'mali_zalogaj',
                category: 'pricing',
                name: 'priceEur',
            });

            await upsertAttributeValue({
                id: priceValue.id,
                attributeDefinitionId: priceValue.definition.id,
                entityId: priceValue.entityId,
                entityTypeName: sunflowerPackageEntityTypeName,
                order: priceValue.definition.order,
                value,
            });

            await assert.rejects(
                () => getSunflowerPackages(),
                /pricing.priceEur must be numeric/,
                `Expected ${value} to be rejected`,
            );
        }
    } finally {
        const priceValue = await findPackageAttributeValueId({
            code: 'mali_zalogaj',
            category: 'pricing',
            name: 'priceEur',
        });
        await upsertAttributeValue({
            id: priceValue.id,
            attributeDefinitionId: priceValue.definition.id,
            entityId: priceValue.entityId,
            entityTypeName: sunflowerPackageEntityTypeName,
            order: priceValue.definition.order,
            value: originalPriceValue.value,
        });
    }
});
