import type { GardenAvatarView } from '../../useGameState';

export function getGardenAvatarZoomStart(view: GardenAvatarView) {
    return {
        restoreThirdPerson: view === 'third-person',
        view: view === 'third-person' ? ('first-person' as const) : view,
    };
}

export function getGardenAvatarZoomReleaseView({
    restoreThirdPerson,
    view,
}: {
    restoreThirdPerson: boolean;
    view: GardenAvatarView;
}): GardenAvatarView {
    return restoreThirdPerson && view === 'first-person'
        ? 'third-person'
        : view;
}
