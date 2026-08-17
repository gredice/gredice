import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const actionsSource = readFileSync(
    new URL('./actions.ts', import.meta.url),
    'utf8',
);

test('publishes detailed inspections only for verified admin completions', () => {
    const notificationBoundaryStart = actionsSource.indexOf(
        'async function notifyAdminVerifiedDetailedInspection',
    );
    const notificationBoundaryEnd = actionsSource.indexOf(
        '\nfunction submissionFailure',
        notificationBoundaryStart,
    );
    const notificationBoundary = actionsSource.slice(
        notificationBoundaryStart,
        notificationBoundaryEnd,
    );

    expect(notificationBoundaryStart).toBeGreaterThan(-1);
    expect(notificationBoundary).toContain("actorRole !== 'admin'");
    expect(notificationBoundary).toContain("status !== 'completed'");
    expect(notificationBoundary).toMatch(
        /expectedEntityId !==\s+RAISED_BED_DETAILED_INSPECTION_OPERATION_ID/,
    );
    expect(notificationBoundary).toContain(
        'await notifyDetailedRaisedBedInspectionVerified(operationId)',
    );
    expect(
        actionsSource.match(/await notifyAdminVerifiedDetailedInspection\(\{/g),
    ).toHaveLength(2);
    expect(actionsSource).not.toContain(
        'notifyDetailedRaisedBedInspectionCompleted',
    );
});
