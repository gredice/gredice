import { Vector3 } from 'three';
import type { GardenAvatarPresence } from '../../useGameState';

export const animalAvatarFollowDistance = 0.9;
export const animalAvatarFollowSeconds = 60;
export const animalAvatarFollowRepathSeconds = 0.7;
export const animalAvatarPresenceMaxAgeSeconds = 0.5;

export function isFreshGardenAvatarPresence(
    presence: GardenAvatarPresence | null,
    now: number,
): presence is GardenAvatarPresence {
    return (
        presence !== null &&
        now - presence.updatedAt <= animalAvatarPresenceMaxAgeSeconds
    );
}

export function getAnimalAvatarFollowPosition(
    presence: GardenAvatarPresence,
    followDistance = animalAvatarFollowDistance,
) {
    return new Vector3(
        presence.position.x + Math.sin(presence.yaw) * followDistance,
        presence.position.y,
        presence.position.z + Math.cos(presence.yaw) * followDistance,
    );
}
