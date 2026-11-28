import type { Object3D } from 'three';
import {
    collectGhostTemplateParts,
    type GhostTemplateCollection,
    getGhostTemplateSignature,
    isFinalGhostTemplateCollection,
} from './ghostTemplateParts';

/** What one settle check found (`GhostTemplateSettler.settle`). */
export type GhostTemplateSettleResult = 'changed' | 'frozen' | 'waiting';

/**
 * Collects a ghost template's parts while it settles, then freezes it.
 *
 * Freezing hides the template (`Activity` marks its objects invisible), and
 * a hidden template has no drawable parts left. So freezing is decided
 * here, synchronously, and a frozen settler never collects again: a check
 * or commit callback that runs after the freeze, before its timer is
 * cleared, keeps the final parts instead of replacing them with an empty
 * fallback.
 */
export type GhostTemplateSettler = {
    /** The last collection, or null before the first. */
    readonly collection: GhostTemplateCollection | null;
    readonly frozen: boolean;
    /**
     * Collects the parts below `root` again if what it draws changed since
     * the last collection; true if it had. Does nothing once frozen.
     */
    collect(root: Object3D | null): boolean;
    /**
     * One periodic check: collects when the template changed, and freezes
     * when it held still with a final collection (drawable parts or a
     * skinned rig). An empty template may still be loading and is not
     * frozen.
     */
    settle(root: Object3D | null): GhostTemplateSettleResult;
};

export function createGhostTemplateSettler(
    options: { maxInstancesPerMesh?: number } = {},
): GhostTemplateSettler {
    let collection: GhostTemplateCollection | null = null;
    let signature: number | null = null;
    let frozen = false;

    const collect = (root: Object3D | null) => {
        if (frozen || !root) {
            return false;
        }
        const next = getGhostTemplateSignature(root);
        if (next === signature) {
            return false;
        }
        signature = next;
        collection = collectGhostTemplateParts(root, options);
        return true;
    };

    return {
        get collection() {
            return collection;
        },
        get frozen() {
            return frozen;
        },
        collect,
        settle(root) {
            if (frozen) {
                return 'frozen';
            }
            if (collect(root)) {
                return 'changed';
            }
            if (isFinalGhostTemplateCollection(collection)) {
                frozen = true;
                return 'frozen';
            }
            return 'waiting';
        },
    };
}
