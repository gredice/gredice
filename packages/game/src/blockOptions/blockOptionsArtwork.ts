import type { BlockOptionsAction } from './blockOptionsActions';
import { blockOptionsToolbarCopy } from './blockOptionsCopy';

/**
 * Generated HUD artwork for block editing, in the style of the backpack and
 * basket icons (`apps/garden/public/assets/hud/README.md`). Each image has a
 * `.prompt.json` next to it.
 */
export const blockOptionsArtSrc = {
    expand: '/assets/hud/block-expand.webp',
    rotate: '/assets/hud/block-rotate.webp',
    recycle: '/assets/hud/block-recycle.webp',
    delete: '/assets/hud/block-delete.webp',
    move: '/assets/hud/block-move.webp',
    confirm: '/assets/hud/action-confirm.webp',
    cancel: '/assets/hud/action-cancel.webp',
} as const;

export type BlockOptionsArt = keyof typeof blockOptionsArtSrc;

/**
 * Colour role of a medallion or candy button (GAME_ART.md role table):
 * sunflower yellow, water blue, grass green, ripe red, carrot orange, and
 * the cream of the HUD cards.
 */
export type BlockOptionsTone =
    | 'sunflower'
    | 'water'
    | 'grass'
    | 'ripe'
    | 'carrot'
    | 'cream';

const artTones: Record<BlockOptionsArt, BlockOptionsTone> = {
    expand: 'sunflower',
    rotate: 'water',
    recycle: 'grass',
    delete: 'ripe',
    move: 'carrot',
    confirm: 'grass',
    cancel: 'cream',
};

export function getBlockOptionsArtTone(art: BlockOptionsArt) {
    return artTones[art];
}

/**
 * The artwork of a pop-up tile. Recikliraj and Obriši share the `remove`
 * action; sandbox gardens label it Obriši, which deletes with no refund, so
 * it gets the red bin instead of the compost crate.
 */
export function getBlockOptionsActionArt(
    action: Pick<BlockOptionsAction, 'id' | 'label'>,
): BlockOptionsArt {
    if (action.id !== 'remove') {
        return action.id;
    }
    return action.label === blockOptionsToolbarCopy.actions.delete
        ? 'delete'
        : 'recycle';
}
