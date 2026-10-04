import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

test('game source cannot reinstall the global react-spring Three driver', () => {
    const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
    const violations: string[] = [];
    for (const path of readdirSync(sourceRoot, { recursive: true })) {
        if (typeof path !== 'string' || !/\.tsx?$/.test(path)) continue;
        const source = readFileSync(join(sourceRoot, path), 'utf8');
        for (const statement of source.matchAll(
            /^(?:import|export)\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gm,
        )) {
            if (
                statement[2] === '@react-spring/three' &&
                !statement[1]?.trimStart().startsWith('type ')
            )
                violations.push(path);
        }
    }
    assert.deepEqual(
        violations,
        [],
        'Use scene/sceneSpring for root-owned animations; upstream Three types may be imported with import type.',
    );
});
