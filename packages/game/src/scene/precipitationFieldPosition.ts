import type { GardenAvatarView } from '../useGameState';

type HorizontalPosition = Readonly<{
    x: number;
    z: number;
}>;

export function resolvePrecipitationFieldPosition({
    activeCameraPosition,
    avatarView,
    followCamera,
    overviewTarget,
}: {
    activeCameraPosition: HorizontalPosition;
    avatarView: GardenAvatarView;
    followCamera: boolean;
    overviewTarget?: readonly [x: number, y: number, z: number];
}): HorizontalPosition | null {
    if (!followCamera) {
        return null;
    }

    if (avatarView !== 'overview' || !overviewTarget) {
        return activeCameraPosition;
    }

    return { x: overviewTarget[0], z: overviewTarget[2] };
}
