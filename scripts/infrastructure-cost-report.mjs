import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const DAY_MS = 86_400_000;

function timestamp(value, label) {
    if (
        typeof value !== 'string' ||
        !/T.*(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
    ) {
        throw new Error(`${label} must be an ISO timestamp with a timezone`);
    }
    const result = Date.parse(value);
    if (!Number.isFinite(result)) throw new Error(`${label} is invalid`);
    return result;
}

function amount(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number`);
    }
    return value;
}

export function parseCharges(source) {
    return source
        .split(/\r?\n/u)
        .filter((line) => line.trim())
        .map((line, index) => {
            try {
                return JSON.parse(line);
            } catch {
                throw new Error(`Invalid charge JSON at line ${index + 1}`);
            }
        });
}

// Uses whole provider billing periods; never prorates a rollout-straddling day.
export function summarizeCharges(
    rows,
    { from, until, cutover, now = new Date().toISOString() },
) {
    const start = timestamp(from, 'from');
    const end = timestamp(until, 'until');
    const current = timestamp(now, 'now');
    const rollout =
        cutover === undefined ? null : timestamp(cutover, 'cutover');
    if (end <= start || end > current)
        throw new Error('Window must be past and have positive duration');
    const periods = new Map();
    const groups = new Map();
    let effectiveUsd = 0;
    let billedUsd = 0;
    let subscriptionEffectiveUsd = 0;
    let subscriptionBilledUsd = 0;
    let subscriptionRows = 0;
    let includedRows = 0;
    for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row))
            throw new Error('Invalid charge row');
        const rowStart = timestamp(row.ChargePeriodStart, 'ChargePeriodStart');
        const rowEnd = timestamp(row.ChargePeriodEnd, 'ChargePeriodEnd');
        if (rowEnd <= rowStart) throw new Error('Invalid charge period');
        if (rowEnd <= start || rowStart >= end) continue;
        if (rowStart < start || rowEnd > end)
            throw new Error('Window cuts through a provider charge period');
        if (
            row.ChargeCategory !== 'Usage' ||
            row.ServiceProviderName !== 'Vercel'
        ) {
            throw new Error(
                'Export must contain only Vercel Usage charges; report other services separately',
            );
        }
        if (row.BillingCurrency !== 'USD')
            throw new Error('Mixed or unsupported billing currency');
        const effective = amount(row.EffectiveCost, 'EffectiveCost');
        const billed = amount(row.BilledCost, 'BilledCost');
        if (row.ServiceCategory === 'Subscription Licenses') {
            subscriptionEffectiveUsd += effective;
            subscriptionBilledUsd += billed;
            subscriptionRows++;
            continue;
        }
        periods.set(`${rowStart}:${rowEnd}`, [rowStart, rowEnd]);
        const quantity =
            row.ConsumedQuantity === null
                ? null
                : amount(row.ConsumedQuantity, 'ConsumedQuantity');
        if (
            typeof row.ServiceName !== 'string' ||
            (row.ConsumedUnit !== null &&
                typeof row.ConsumedUnit !== 'string') ||
            typeof row.SkuId !== 'string'
        ) {
            throw new Error('Charge row needs service, SKU and consumed unit');
        }
        const project =
            typeof row.Tags?.ProjectName === 'string'
                ? row.Tags.ProjectName
                : 'unattributed';
        const key = JSON.stringify([project, row.SkuId, row.ConsumedUnit]);
        const group = groups.get(key) ?? {
            project,
            service: row.ServiceName,
            sku: row.SkuId,
            unit: row.ConsumedUnit,
            quantity: 0,
            effectiveUsd: 0,
            billedUsd: 0,
        };
        group.quantity =
            group.quantity === null || quantity === null
                ? null
                : group.quantity + quantity;
        group.effectiveUsd += effective;
        group.billedUsd += billed;
        groups.set(key, group);
        effectiveUsd += effective;
        billedUsd += billed;
        includedRows++;
    }
    const orderedPeriods = [...periods.values()].sort((a, b) => a[0] - b[0]);
    let cursor = start;
    for (const [periodStart, periodEnd] of orderedPeriods) {
        if (periodStart !== cursor)
            throw new Error('Export has a gap or overlapping billing periods');
        cursor = periodEnd;
    }
    if (cursor !== end)
        throw new Error('Export does not cover the requested window');
    const days = (end - start) / DAY_MS;
    const monthlyPaceUsd = (effectiveUsd * 30) / days;
    return {
        from: new Date(start).toISOString(),
        until: new Date(end).toISOString(),
        days,
        includedRows,
        effectiveUsd,
        billedUsd,
        monthlyPaceUsd,
        subscriptions: {
            rows: subscriptionRows,
            effectiveUsd: subscriptionEffectiveUsd,
            billedUsd: subscriptionBilledUsd,
        },
        postRollout: rollout !== null && start >= rollout,
        comparable72Hours: rollout !== null && start >= rollout && days >= 3,
        withinHeadroomPace: monthlyPaceUsd <= 15,
        withinIncludedUsagePace: monthlyPaceUsd <= 20,
        groups: [...groups.values()].sort(
            (a, b) => b.effectiveUsd - a.effectiveUsd,
        ),
        limits: [
            'Use EffectiveCost for matched infrastructure pace and BilledCost for invoicing; credits and subscription licenses are separate.',
            'A 30-day linear pace is a forecast, not an actual monthly bill or proof of traffic headroom.',
            'Period coverage does not prove export completeness. Confirm all projects, SKUs, regions and pagination at the provider.',
            'Neon, Silo and other provider charges, traffic, cache/queue latency and correctness require separate matched evidence.',
        ],
    };
}

export function compareReports(before, after) {
    if (before.days !== after.days)
        throw new Error('Before and after windows must have equal duration');
    if (Date.parse(before.until) > Date.parse(after.from))
        throw new Error('Comparison windows must not overlap');
    return {
        effectiveDeltaUsd: after.effectiveUsd - before.effectiveUsd,
        effectiveChangePercent:
            before.effectiveUsd === 0
                ? null
                : (after.effectiveUsd / before.effectiveUsd - 1) * 100,
        billedDeltaUsd: after.billedUsd - before.billedUsd,
    };
}

if (
    process.argv[1] &&
    resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    try {
        const { values } = parseArgs({
            options: {
                input: { type: 'string' },
                from: { type: 'string' },
                until: { type: 'string' },
                cutover: { type: 'string' },
                'baseline-from': { type: 'string' },
                'baseline-until': { type: 'string' },
            },
        });
        if (!values.input || !values.from || !values.until) {
            throw new Error(
                'Usage: node scripts/infrastructure-cost-report.mjs --input charges.ndjson --from ISO --until ISO [--cutover ISO] [--baseline-from ISO --baseline-until ISO]',
            );
        }
        if (
            Boolean(values['baseline-from']) !==
            Boolean(values['baseline-until'])
        )
            throw new Error('Both baseline bounds are required');
        const rows = parseCharges(readFileSync(values.input, 'utf8'));
        const after = summarizeCharges(rows, values);
        const before = values['baseline-from']
            ? summarizeCharges(rows, {
                  from: values['baseline-from'],
                  until: values['baseline-until'],
              })
            : null;
        console.log(
            JSON.stringify(
                {
                    after,
                    ...(before
                        ? { before, comparison: compareReports(before, after) }
                        : {}),
                },
                null,
                2,
            ),
        );
    } catch (error) {
        console.error(
            error instanceof Error ? error.message : 'Cost report failed',
        );
        process.exitCode = 1;
    }
}
