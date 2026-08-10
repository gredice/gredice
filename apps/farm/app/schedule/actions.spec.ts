import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const actionsSource = readFileSync(
    new URL('./actions.ts', import.meta.url),
    'utf8',
);

test('retries the idempotent detailed-inspection notification before returning a keyed replay', () => {
    const replayStart = actionsSource.indexOf('if (replay) {');
    const replayEnd = actionsSource.indexOf(
        '        } catch (error) {',
        replayStart,
    );
    const replayBlock = actionsSource.slice(replayStart, replayEnd);

    expect(replayStart).toBeGreaterThan(-1);
    expect(replayEnd).toBeGreaterThan(replayStart);
    expect(replayBlock).toContain(
        'RAISED_BED_DETAILED_INSPECTION_OPERATION_ID',
    );

    const notificationCall = replayBlock.indexOf(
        'await notifyDetailedRaisedBedInspectionCompleted(',
    );
    const replayReturn = replayBlock.indexOf('return actionResult(');

    expect(notificationCall).toBeGreaterThan(-1);
    expect(replayReturn).toBeGreaterThan(notificationCall);
});
