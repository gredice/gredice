import type { GameSceneProps } from '@gredice/game';

export const gameProfileGardenSwitchEventName =
    'gredice:game-profile-garden-switch';

export type GameProfileGardenSwitchProfile = Extract<
    NonNullable<GameSceneProps['mockGardenProfile']>,
    'fauna-heavy' | 'high-target'
>;

export function readGameProfileGardenSwitchProfile(value: unknown) {
    if (typeof value !== 'object' || value === null) {
        return undefined;
    }

    const profile = Reflect.get(value, 'profile');
    return profile === 'fauna-heavy' || profile === 'high-target'
        ? profile
        : undefined;
}
