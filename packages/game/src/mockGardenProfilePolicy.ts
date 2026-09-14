export const faunaHeavyMockGardenProfile = 'fauna-heavy';

export function isDeterministicEmptyMockGardenProfile(profile: string) {
    return profile === 'high-target' || profile === faunaHeavyMockGardenProfile;
}
