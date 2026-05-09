import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findClosestForecastEntry, pickFarmSnowAccumulation } from './weatherNowContract';

describe('findClosestForecastEntry', () => {
  it('returns closest by datetime across forecast days', () => {
    const forecast = [
      { date: '2026-05-09', entries: [{ time: 12, temperature: 10, symbol: 1, windDirection: 'N', windStrength: 1, rain: 0 }] },
      { date: '2026-05-10', entries: [{ time: 0, temperature: 8, symbol: 2, windDirection: 'E', windStrength: 2, rain: 1 }] },
    ];

    const closest = findClosestForecastEntry(forecast, new Date('2026-05-09T12:20:00+01:00').getTime());
    assert.equal(closest?.symbol, 1);
  });
});

describe('pickFarmSnowAccumulation', () => {
  const farms = [
    { id: 'farm-a', snowAccumulation: 1 },
    { id: 'farm-b', snowAccumulation: 4 },
  ];

  it('uses explicit farm id when provided', () => {
    assert.equal(pickFarmSnowAccumulation(farms, 'farm-b'), 4);
  });

  it('falls back to first farm when id is missing or invalid', () => {
    assert.equal(pickFarmSnowAccumulation(farms), 1);
    assert.equal(pickFarmSnowAccumulation(farms, 'missing'), 1);
  });
});
