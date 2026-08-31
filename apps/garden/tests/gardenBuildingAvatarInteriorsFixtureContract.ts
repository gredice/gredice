import { gardenAvatarRadius } from '../../../packages/game/src/entities/avatar/gardenAvatarMovement';

const houseMainDoorPortalZ = 2.5;

export const gardenBuildingAvatarDoorwayFixture = Object.freeze({
    portalZ: houseMainDoorPortalZ,
    porchSpawnZ: 3.25,
    roomSpawnZ: houseMainDoorPortalZ - gardenAvatarRadius - 0.007,
});
