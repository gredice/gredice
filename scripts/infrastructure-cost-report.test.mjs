import assert from 'node:assert/strict';
import test from 'node:test';
import {
    compareReports,
    parseCharges,
    summarizeCharges,
} from './infrastructure-cost-report.mjs';

function charge(start, end, overrides = {}) {
    return {
        ChargePeriodStart: start,
        ChargePeriodEnd: end,
        ChargeCategory: 'Usage',
        ServiceProviderName: 'Vercel',
        BillingCurrency: 'USD',
        EffectiveCost: 0.5,
        BilledCost: 0,
        ConsumedQuantity: 100,
        ConsumedUnit: 'Invocations',
        SkuId: 'functions',
        ServiceName: 'Function Invocations',
        Tags: { ProjectName: 'api', secret: 'private-value' },
        ...overrides,
    };
}
const bounds = {
    from: '2026-10-03T07:00:00Z',
    until: '2026-10-06T07:00:00Z',
    cutover: '2026-10-02T05:57:00Z',
    now: '2026-10-07T00:00:00Z',
};
const rows = [0, 1, 2].map((i) =>
    charge(`2026-10-0${3 + i}T07:00:00Z`, `2026-10-0${4 + i}T07:00:00Z`),
);

test('groups projects and SKUs without mixing credits, units or private tags', () => {
    const report = summarizeCharges(
        [
            ...rows,
            charge(bounds.from, '2026-10-04T07:00:00Z', {
                EffectiveCost: 0.1,
                ConsumedUnit: 'GB',
                SkuId: 'egress',
                Tags: { ProjectName: 'www' },
            }),
        ],
        bounds,
    );
    assert.equal(report.effectiveUsd, 1.6);
    assert.equal(report.billedUsd, 0);
    assert.equal(report.monthlyPaceUsd, 16);
    assert.equal(report.comparable72Hours, true);
    assert.equal(report.withinHeadroomPace, false);
    assert.equal(report.withinIncludedUsagePace, true);
    assert.equal(report.groups[0].quantity, 300);
    assert.equal(JSON.stringify(report).includes('private-value'), false);
});

test('rejects incomplete, overlapping, partial or future provider windows', () => {
    assert.throws(() => summarizeCharges(rows.slice(1), bounds), /gap/u);
    assert.throws(() => summarizeCharges([rows[0], rows[2]], bounds), /gap/u);
    assert.throws(
        () =>
            summarizeCharges(
                [...rows, charge(bounds.from, bounds.until)],
                bounds,
            ),
        /overlapping/u,
    );
    assert.throws(
        () =>
            summarizeCharges(rows, { ...bounds, from: '2026-10-03T08:00:00Z' }),
        /cuts through/u,
    );
    assert.throws(
        () => summarizeCharges(rows, { ...bounds, now: bounds.from }),
        /past/u,
    );
    assert.throws(() => summarizeCharges([], bounds), /cover/u);
});

test('rejects mixed currencies, categories and malformed amounts rather than treating them as free', () => {
    for (const overrides of [
        { BillingCurrency: 'EUR' },
        { EffectiveCost: null },
        { BilledCost: '0' },
        { ConsumedQuantity: Infinity },
        { ChargeCategory: 'Purchase' },
        { ServiceProviderName: 'Neon' },
    ]) {
        assert.throws(() =>
            summarizeCharges(
                [charge(bounds.from, bounds.until, overrides)],
                bounds,
            ),
        );
    }
    assert.throws(() => parseCharges('secret content'), /line 1/u);
    assert.equal(parseCharges(`\n${JSON.stringify(rows[0])}\n`).length, 1);
});

test('pre-cutover and short windows never qualify as a comparable 72-hour rollout', () => {
    assert.equal(
        summarizeCharges(rows, { ...bounds, cutover: bounds.until })
            .comparable72Hours,
        false,
    );
    assert.equal(
        summarizeCharges([rows[0]], {
            ...bounds,
            until: rows[0].ChargePeriodEnd,
        }).comparable72Hours,
        false,
    );
});

test('separates provider subscription licenses even when categorized as Usage', () => {
    const report = summarizeCharges(
        [
            ...rows,
            ...rows.map((row) => ({
                ...row,
                ServiceName: 'Pro',
                ServiceCategory: 'Subscription Licenses',
                EffectiveCost: 2 / 3,
                BilledCost: 1 / 3,
                ConsumedQuantity: 1,
                ConsumedUnit: null,
            })),
        ],
        bounds,
    );
    assert.equal(report.effectiveUsd, 1.5);
    assert.equal(report.subscriptions.effectiveUsd, 2);
    assert.equal(report.subscriptions.billedUsd, 1);
    assert.equal(report.groups.length, 1);
});

test('baseline comparison requires matched durations and nonoverlapping windows', () => {
    const after = summarizeCharges(rows, bounds);
    const before = {
        ...after,
        from: '2026-09-28T07:00:00Z',
        until: '2026-10-01T07:00:00Z',
        effectiveUsd: 3,
        billedUsd: 0.2,
    };
    assert.deepEqual(compareReports(before, after), {
        effectiveDeltaUsd: -1.5,
        effectiveChangePercent: -50,
        billedDeltaUsd: -0.2,
    });
    assert.throws(
        () => compareReports({ ...before, days: 2 }, after),
        /equal/u,
    );
    assert.throws(() => compareReports(after, after), /overlap/u);
    assert.equal(
        compareReports({ ...before, effectiveUsd: 0 }, after)
            .effectiveChangePercent,
        null,
    );
});

test('subscription rows cannot fill absent metered coverage or prove free infrastructure', () => {
    const subscriptionRows = rows.map((row) => ({
        ...row,
        ServiceCategory: 'Subscription Licenses',
        ConsumedUnit: null,
    }));
    assert.throws(() => summarizeCharges(subscriptionRows, bounds), /cover/u);
    assert.throws(
        () => summarizeCharges([rows[0], rows[2], ...subscriptionRows], bounds),
        /gap/u,
    );
});

test('null consumption remains unavailable and null units stay distinct', () => {
    const report = summarizeCharges(
        [
            ...rows,
            { ...rows[0], ConsumedQuantity: null },
            { ...rows[0], ConsumedUnit: null },
        ],
        bounds,
    );
    assert.equal(
        report.groups.find((group) => group.unit === 'Invocations').quantity,
        null,
    );
    assert.equal(
        report.groups.find((group) => group.unit === null).quantity,
        100,
    );
    assert.equal(report.effectiveUsd, 2.5);
});
