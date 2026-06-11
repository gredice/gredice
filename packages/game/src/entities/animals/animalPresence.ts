import { Vector3 } from 'three';
import type { AnimalPresenceEntry } from '../../useGameState';

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
    entries: AnimalPresenceEntry[];
    now: number;
    species: string;
}) {
    return entries.filter(
        (entry) =>
            entry.species === species &&
            now - entry.updatedAt <= animalInteractionMaxAgeSeconds,
    );
}
