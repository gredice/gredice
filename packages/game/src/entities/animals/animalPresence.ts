import { Vector3 } from 'three';
import type { AnimalPresenceEntry } from '../../useGameState';
import type { FaunaWorld } from './faunaWorld';

export const animalPresenceUpdateIntervalSeconds = 0.4;
export const animalInteractionMaxAgeSeconds = 3.5;

export function animalPresencePosition(entry: AnimalPresenceEntry) {
    return new Vector3(entry.position.x, entry.position.y, entry.position.z);
}

export function freshAnimalPresences({
    entries,
    now,
    species,
}: {
    entries: readonly AnimalPresenceEntry[];
    now: number;
    species: string;
}) {
    return entries.filter(
        (entry) =>
            entry.species === species &&
            now - entry.updatedAt <= animalInteractionMaxAgeSeconds,
    );
}

/** Birds currently foraging on the ground, as cats and dogs stalk them. */
export function groundBirdEntries(faunaWorld: FaunaWorld) {
    return faunaWorld
        .getDebugEntries()
        .filter(
            (entry) => entry.species === 'Bird' && entry.behavior === 'ground',
        );
}
