import assert from 'node:assert/strict';
import test from 'node:test';
import { loadReviewedAutumnStarterPackEvidence } from './autumnStarterPackEvidence';

test('reviewed evidence parses the manifest supplied by the inspected reader', async () => {
    const paths: string[] = [];
    await assert.rejects(
        loadReviewedAutumnStarterPackEvidence(async (path) => {
            paths.push(path);
            return new TextEncoder().encode('{}');
        }),
        /Missing reviewed evidence: harvest-corner/,
    );
    assert.deepEqual(paths, [
        'apps/api/lib/garden/autumnStarterPackEvidence.reviewed.json',
    ]);
});
