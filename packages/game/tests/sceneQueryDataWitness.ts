import { Vector3 } from 'three';
import { getLocalSandboxBlockData } from '../src/localSandboxBlockData';
import type { Stack } from '../src/types/Stack';

export type SceneQueryDataMode =
    | 'connected'
    | 'owner'
    | 'raw-fanout'
    | 'supplied'
    | 'supplied-undefined'
    | 'supplied-null'
    | 'empty';

export function createSceneQueryData(height: number) {
    return getLocalSandboxBlockData()
        .filter((block) =>
            ['Block_Grass', 'Bucket'].includes(block.information.name),
        )
        .map((block) =>
            block.information.name === 'Block_Grass'
                ? {
                      ...block,
                      attributes: { ...block.attributes, height },
                  }
                : block,
        );
}

export function createSceneQueryStacks(index: number): Stack[] {
    return [
        {
            position: new Vector3(
                (index % 4) - 1.5,
                0,
                Math.floor(index / 4) - 1.5,
            ),
            blocks: [
                { id: `ground-${index}`, name: 'Block_Grass', rotation: 0 },
                { id: `bucket-${index}`, name: 'Bucket', rotation: 0 },
            ],
        },
    ];
}

export function createSceneQueryGate(initiallySuspended: boolean) {
    let resolve: (() => void) | undefined;
    const gate = {
        pending: initiallySuspended,
        promise: Promise.resolve(),
        suspend() {
            gate.pending = true;
            gate.promise = new Promise<void>((done) => {
                resolve = done;
            });
        },
        reveal() {
            gate.pending = false;
            resolve?.();
            resolve = undefined;
        },
    };
    if (initiallySuspended) gate.suspend();
    return gate;
}
