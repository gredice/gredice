import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSuncokretUsageStatus,
    suncokretUsagePeriod,
} from './suncokretUsage';

test('suncokretUsagePeriod reports used and remaining percentages', () => {
    assert.deepStrictEqual(
        suncokretUsagePeriod({ limit: 1_000, used: 200, reserved: 50 }),
        { usedPercent: 25, remainingPercent: 75 },
    );
    assert.deepStrictEqual(
        suncokretUsagePeriod({ limit: 100, used: 150, reserved: 0 }),
        { usedPercent: 100, remainingPercent: 0 },
    );
});

test('buildSuncokretUsageStatus includes live day and week progress rates', () => {
    const status = buildSuncokretUsageStatus({
        dailyLimit: 1_000,
        dailyReserved: 0,
        dailyUsed: 100,
        outputUsageUnitsPerToken: 2,
        weeklyLimit: 7_000,
        weeklyReserved: 0,
        weeklyUsed: 350,
    });

    assert.deepStrictEqual(status.day, {
        usedPercent: 10,
        remainingPercent: 90,
    });
    assert.deepStrictEqual(status.week, {
        usedPercent: 5,
        remainingPercent: 95,
    });
    assert.strictEqual(status.liveOutputPercentPerToken.day, 0.2);
    assert.ok(status.liveOutputPercentPerToken.week > 0);
});
