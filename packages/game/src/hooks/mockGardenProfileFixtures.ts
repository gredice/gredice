import type { MockGardenProfile } from '../useGameState';

/**
 * The plant-heavy profiler freezes scene time on 2024-06-21. Keeping its mock
 * lifecycle dates anchored to that fixture prevents the plants from becoming
 * future-dated as wall-clock time advances, which previously reduced every
 * plant to generation zero and left the foliage counter empty.
 */
export const plantHeavyMockGardenReferenceDate = '2024-06-21T12:00:00.000Z';

export function resolveMockGardenProfileReferenceDate(
    profile: MockGardenProfile,
    currentDate = new Date(),
) {
    return profile === 'plant-heavy'
        ? plantHeavyMockGardenReferenceDate
        : currentDate.toISOString();
}
