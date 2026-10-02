import type { AnimalDebugCommand, AnimalDebugEntry } from '../src/useGameState';
import type { FaunaPoseOracleFrame } from './faunaPoseOracle';

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
