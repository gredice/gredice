import { birdHouseRoofColor, birdHouseRoofRoughness } from './birdHousePalette';

// Colours every animal home shares, as authored albedo. The exported homes take
// the same values: assets/scripts/party-pass-homes.py reads this file and
// birdHousePalette.ts, so a change here and a re-run of that script keep the
// GLBs and DogHouse.tsx in step.

/** Every home has the bird house's painted red roof. */
export const animalHomeRoofColor = birdHouseRoofColor;
export const animalHomeRoofRoughness = birdHouseRoofRoughness;

/** Doorways and vents read as a cool shadowed interior, never black. */
export const animalHomeDoorwayColor = '#3e3759';
export const animalHomeDoorwayRoughness = 0.8;
