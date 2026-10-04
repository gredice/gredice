import { Vector3 } from 'three';

export function createLadybugSuspenseGate() {
    let pending = false;
    let promise = Promise.resolve();
    let resolve = () => {};
    return {
        read() {
            if (pending) throw promise;
        },
        suspend() {
            pending = true;
            promise = new Promise<void>((complete) => {
                resolve = complete;
            });
        },
        reveal() {
            pending = false;
            resolve();
        },
    };
}

export function createLadybugSuspenseGarden() {
    return {
        id: 4715,
        stacks: [-1, 1].map((x, index) => ({
            position: new Vector3(x, 0, 0),
            blocks: [
                { id: `ground-${index}`, name: 'Block_Grass', rotation: 0 },
                { id: `bed-${index}`, name: 'Raised_Bed', rotation: 0 },
            ],
        })),
        raisedBeds: [0, 1].map((index) => ({
            id: index + 1,
            blockId: `bed-${index}`,
            fields: [
                {
                    active: true,
                    plantSortId: 337,
                    plantStatus: 'ready',
                    positionIndex: 0,
                },
            ],
        })),
    };
}

export type LadybugSuspenseLifecycle = {
    mounts: number;
    cleanups: number;
    live: boolean;
};
