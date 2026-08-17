import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const actionsSource = readFileSync(
    new URL('./actions.ts', import.meta.url),
    'utf8',
);

test('does not publish detailed inspections from the farmer completion action', () => {
    expect(actionsSource).not.toContain(
        'notifyDetailedRaisedBedInspectionVerified',
    );
    expect(actionsSource).not.toContain(
        'notifyDetailedRaisedBedInspectionCompleted',
    );
});
