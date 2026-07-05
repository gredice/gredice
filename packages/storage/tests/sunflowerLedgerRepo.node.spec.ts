import assert from 'node:assert/strict';
import test from 'node:test';
import {
    captureSunflowerReservation,
    correctSunflowerBalance,
    getSunflowerLedgerBalance,
    getSunflowerLedgerHistory,
    getSunflowerReservationEntries,
    refundSunflowers,
    releaseSunflowerReservation,
    reserveSunflowers,
    topUpSunflowerPackage,
} from '@gredice/storage';
import { createTestAccount } from './helpers/testHelpers';
import { createTestDb } from './testDb';

test('topUpSunflowerPackage credits purchased and bonus sunflowers idempotently', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    const first = await topUpSunflowerPackage({
        accountId,
        packageCode: 'vrtna_kosarica',
        sunflowers: 42000,
        bonusSunflowers: 2000,
        priceCents: 3999,
        idempotencyKey: 'checkout-session-ledger-topup',
    });
    const second = await topUpSunflowerPackage({
        accountId,
        packageCode: 'vrtna_kosarica',
        sunflowers: 42000,
        bonusSunflowers: 2000,
        priceCents: 3999,
        idempotencyKey: 'checkout-session-ledger-topup',
    });

    assert.equal(first.topUp.status, 'created');
    assert.equal(first.bonus?.status, 'created');
    assert.equal(second.topUp.status, 'existing');
    assert.equal(second.bonus?.status, 'existing');
    assert.deepEqual(await getSunflowerLedgerBalance(accountId), {
        available: 42000,
        reserved: 0,
        total: 42000,
    });
});

test('reserve, release, and capture move available and reserved balances safely', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await topUpSunflowerPackage({
        accountId,
        packageCode: 'mali_zalogaj',
        sunflowers: 5000,
        idempotencyKey: 'checkout-session-ledger-reserve',
    });

    const reserved = await reserveSunflowers({
        accountId,
        amount: 1200,
        reservationKey: 'operation:reserve-release',
        sourceType: 'operation',
        sourceId: '101',
        idempotencyKey: 'operation:reserve-release:reserve',
    });
    assert.equal(reserved.status, 'created');
    assert.deepEqual(await getSunflowerLedgerBalance(accountId), {
        available: 3800,
        reserved: 1200,
        total: 5000,
    });

    const partialRelease = await releaseSunflowerReservation({
        accountId,
        amount: 500,
        reservationKey: 'operation:reserve-release',
        idempotencyKey: 'operation:reserve-release:release',
    });
    assert.equal(partialRelease.status, 'created');
    assert.deepEqual(await getSunflowerLedgerBalance(accountId), {
        available: 4300,
        reserved: 700,
        total: 5000,
    });

    const capture = await captureSunflowerReservation({
        accountId,
        reservationKey: 'operation:reserve-release',
        idempotencyKey: 'operation:reserve-release:capture',
    });
    assert.equal(capture.status, 'created');
    assert.deepEqual(await getSunflowerLedgerBalance(accountId), {
        available: 4300,
        reserved: 0,
        total: 4300,
    });

    const duplicateCapture = await captureSunflowerReservation({
        accountId,
        reservationKey: 'operation:reserve-release',
        idempotencyKey: 'operation:reserve-release:capture',
    });
    assert.equal(duplicateCapture.status, 'existing');
    assert.deepEqual(await getSunflowerLedgerBalance(accountId), {
        available: 4300,
        reserved: 0,
        total: 4300,
    });
});

test('reserveSunflowers rejects overspend and keeps the balance unchanged', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await topUpSunflowerPackage({
        accountId,
        packageCode: 'mali_zalogaj',
        sunflowers: 5000,
        idempotencyKey: 'checkout-session-ledger-overspend',
    });

    await assert.rejects(
        () =>
            reserveSunflowers({
                accountId,
                amount: 5001,
                reservationKey: 'operation:overspend',
                idempotencyKey: 'operation:overspend:reserve',
            }),
        /Insufficient available sunflowers/,
    );
    assert.deepEqual(await getSunflowerLedgerBalance(accountId), {
        available: 5000,
        reserved: 0,
        total: 5000,
    });
});

test('reserveSunflowers rejects one concurrent overspend', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await topUpSunflowerPackage({
        accountId,
        packageCode: 'mali_zalogaj',
        sunflowers: 1000,
        idempotencyKey: 'checkout-session-ledger-concurrent',
    });

    const results = await Promise.allSettled([
        reserveSunflowers({
            accountId,
            amount: 700,
            reservationKey: 'operation:concurrent-a',
            idempotencyKey: 'operation:concurrent-a:reserve',
        }),
        reserveSunflowers({
            accountId,
            amount: 700,
            reservationKey: 'operation:concurrent-b',
            idempotencyKey: 'operation:concurrent-b:reserve',
        }),
    ]);

    assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
    );
    assert.equal(
        results.filter((result) => result.status === 'rejected').length,
        1,
    );
    assert.deepEqual(await getSunflowerLedgerBalance(accountId), {
        available: 300,
        reserved: 700,
        total: 1000,
    });
});

test('releaseSunflowerReservation skips when no reservation remains', async () => {
    createTestDb();
    const accountId = await createTestAccount();

    const result = await releaseSunflowerReservation({
        accountId,
        reservationKey: 'operation:missing',
        idempotencyKey: 'operation:missing:release',
    });

    assert.deepEqual(result, {
        status: 'skipped',
        reason: 'no_active_reservation',
    });
});

test('refund and correction entries are append-only balance changes', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await topUpSunflowerPackage({
        accountId,
        packageCode: 'mali_zalogaj',
        sunflowers: 5000,
        idempotencyKey: 'checkout-session-ledger-refund',
    });
    await reserveSunflowers({
        accountId,
        amount: 1000,
        reservationKey: 'operation:refund',
        idempotencyKey: 'operation:refund:reserve',
    });
    await captureSunflowerReservation({
        accountId,
        reservationKey: 'operation:refund',
        idempotencyKey: 'operation:refund:capture',
    });

    const refund = await refundSunflowers({
        accountId,
        amount: 300,
        reason: 'support refund',
        idempotencyKey: 'operation:refund:refund',
    });
    const correction = await correctSunflowerBalance({
        accountId,
        amountDelta: -100,
        reason: 'support correction',
        idempotencyKey: 'operation:refund:correction',
    });

    assert.equal(refund.status, 'created');
    assert.equal(correction.status, 'created');
    assert.deepEqual(await getSunflowerLedgerBalance(accountId), {
        available: 4200,
        reserved: 0,
        total: 4200,
    });
    const history = await getSunflowerLedgerHistory({ accountId });
    assert.deepEqual(
        history.slice(0, 2).map((entry) => entry.entryType),
        ['manual_adjustment', 'refund'],
    );
});

test('getSunflowerReservationEntries returns the reservation lifecycle in order', async () => {
    createTestDb();
    const accountId = await createTestAccount();
    await topUpSunflowerPackage({
        accountId,
        packageCode: 'mali_zalogaj',
        sunflowers: 5000,
        idempotencyKey: 'checkout-session-ledger-lifecycle',
    });
    await reserveSunflowers({
        accountId,
        amount: 900,
        reservationKey: 'operation:lifecycle',
        idempotencyKey: 'operation:lifecycle:reserve',
    });
    await releaseSunflowerReservation({
        accountId,
        reservationKey: 'operation:lifecycle',
        idempotencyKey: 'operation:lifecycle:release',
    });

    const entries = await getSunflowerReservationEntries({
        accountId,
        reservationKey: 'operation:lifecycle',
    });
    assert.deepEqual(
        entries.map((entry) => entry.entryType),
        ['reservation', 'reservation_release'],
    );
});
