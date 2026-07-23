import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getGeneratedPlantProfileSnapshot,
    recordGeneratedPlantProfileBatch,
    recordGeneratedPlantProfileBuild,
    recordGeneratedPlantProfileFields,
    recordGeneratedPlantProfileLSystemCancellation,
    recordGeneratedPlantProfileLSystemCompletion,
    recordGeneratedPlantProfileLSystemRequest,
    resetGeneratedPlantProfile,
    startGeneratedPlantProfile,
} from './generatedPlantProfileMetrics';

test('generated plant profile separates intent, pending, and detailed readiness', () => {
    resetGeneratedPlantProfile();
    startGeneratedPlantProfile({
        selectedBlockId: 'bed:1:0',
        selectedRaisedBedId: 1,
    });
    recordGeneratedPlantProfileFields([
        {
            fieldKey: 'selected:0',
            instanceCount: 4,
            lodLevel: 'near',
            raisedBedId: 1,
            visible: true,
        },
        {
            fieldKey: 'background:0',
            instanceCount: 1,
            lodLevel: 'mid',
            raisedBedId: 2,
            visible: true,
        },
    ]);

    let snapshot = getGeneratedPlantProfileSnapshot();
    assert.equal(snapshot?.selected.nearFields, 1);
    assert.equal(snapshot?.selected.pendingNearFields, 0);
    assert.equal(snapshot?.selected.detailedFields, 0);
    assert.notEqual(snapshot?.milestonesMs.nearIntent, null);

    recordGeneratedPlantProfileBatch('selected', {
        fields: [
            {
                fieldKey: 'selected:0',
                instanceCount: 4,
                raisedBedId: 1,
            },
        ],
        status: 'pending-near',
    });
    snapshot = getGeneratedPlantProfileSnapshot();
    assert.equal(snapshot?.selected.pendingNearFields, 1);
    assert.equal(snapshot?.selected.parts.billboardInstances, 4);
    assert.notEqual(snapshot?.milestonesMs.pendingNear, null);

    recordGeneratedPlantProfileBatch('selected', {
        fields: [
            {
                fieldKey: 'selected:0',
                instanceCount: 4,
                parts: {
                    leaves: 20,
                    stems: 12,
                },
                raisedBedId: 1,
            },
        ],
        status: 'detailed',
    });
    snapshot = getGeneratedPlantProfileSnapshot();
    assert.equal(snapshot?.selected.pendingNearFields, 0);
    assert.equal(snapshot?.selected.detailedFields, 1);
    assert.equal(snapshot?.selected.parts.billboardInstances, 0);
    assert.equal(snapshot?.selected.parts.leaves, 20);
    assert.equal(snapshot?.selected.parts.stems, 12);
    assert.notEqual(snapshot?.milestonesMs.firstDetailedField, null);
    assert.notEqual(snapshot?.milestonesMs.fullyDetailed, null);
});

test('generated plant profile reset prevents counts leaking between sessions', () => {
    resetGeneratedPlantProfile();
    startGeneratedPlantProfile({
        selectedBlockId: 'bed:1:0',
        selectedRaisedBedId: 1,
    });
    recordGeneratedPlantProfileLSystemRequest({
        requestedTaskCount: 8,
        workerTaskCount: 6,
    });
    recordGeneratedPlantProfileLSystemCompletion({
        completedTaskCount: 6,
        durationMs: 12,
    });
    recordGeneratedPlantProfileLSystemCancellation(2);
    recordGeneratedPlantProfileBuild({
        buildId: 'first',
        durationMs: 5,
        instanceCount: 4,
    });
    const firstSessionId = getGeneratedPlantProfileSnapshot()?.sessionId;

    startGeneratedPlantProfile({
        selectedBlockId: 'bed:2:0',
        selectedRaisedBedId: 2,
    });
    const snapshot = getGeneratedPlantProfileSnapshot();

    assert.equal(snapshot?.sessionId, (firstSessionId ?? 0) + 1);
    assert.equal(snapshot?.selectedRaisedBedId, 2);
    assert.equal(snapshot?.lSystem.requestedTaskCount, 0);
    assert.equal(snapshot?.lSystem.completedTaskCount, 0);
    assert.equal(snapshot?.lSystem.cancelledTaskCount, 0);
    assert.equal(snapshot?.renderData.buildCount, 0);
    assert.equal(snapshot?.selected.totalFields, 0);
});

test('generated plant profile instrumentation is inert without a debug session', () => {
    resetGeneratedPlantProfile();
    recordGeneratedPlantProfileFields([
        {
            fieldKey: 'ignored',
            instanceCount: 1,
            lodLevel: 'near',
            raisedBedId: 1,
            visible: true,
        },
    ]);

    assert.equal(getGeneratedPlantProfileSnapshot(), null);
});
