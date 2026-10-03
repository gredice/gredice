import type { Object3D, Vector3 } from 'three';
import type { AnimalDebugCommand, AnimalDebugEntry } from '../src/useGameState';
import type { FaunaPoseOracleFrame } from './faunaPoseOracle';

/** Three's singular-matrix decomposition returns unit scale for hidden births. */
export function readFaunaTrajectoryWorldScale(
    object: Object3D,
    target: Vector3,
) {
    object.updateWorldMatrix(true, false);
    const elements = object.matrixWorld.elements;
    const x = Math.hypot(elements[0], elements[1], elements[2]);
    return target.set(
        object.matrixWorld.determinant() < 0 ? -x : x,
        Math.hypot(elements[4], elements[5], elements[6]),
        Math.hypot(elements[8], elements[9], elements[10]),
    );
}

export const faunaTrajectorySpecies = [
    'Cow',
    'Cat',
    'Dog',
    'Bird',
    'Bee',
    'Bat',
    'Butterfly',
    'Ladybug',
    'Frog',
    'Horse',
    'Rabbit',
    'Squirrel',
    'Slug',
    'Chicken',
    'Goat',
    'Piglet',
    'Sheep',
] as const;
export type FaunaTrajectoryScenario = 'day' | 'night' | 'autumn-post-rain';
export type FaunaTrajectoryActor = {
    id: string;
    species: string;
    visible: boolean;
    position: number[];
    quaternion: number[];
    scale: number[];
    pose: {
        name: string;
        position: number[];
        quaternion: number[];
        scale: number[];
    }[];
};
export type FaunaTrajectoryFrame = {
    index: number;
    time: number;
    counts: Record<string, number>;
    actors: FaunaTrajectoryActor[];
    debug: AnimalDebugEntry[];
    visible: boolean;
    submittedFrames: number;
    poseOracle?: FaunaPoseOracleFrame;
};
export type FaunaTrajectoryWitness = {
    ready: () => boolean;
    step: (delta: number) => Promise<FaunaTrajectoryFrame>;
    snapshot: () => FaunaTrajectoryFrame;
    command: (
        command: Omit<AnimalDebugCommand, 'createdAt' | 'sequence'>,
    ) => void;
    automaticHiddenAdvances: () => number;
};

declare global {
    interface Window {
        faunaTrajectoryWitness?: FaunaTrajectoryWitness;
    }
}
