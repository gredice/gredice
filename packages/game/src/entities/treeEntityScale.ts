import type { Vector3Tuple } from 'three';

/**
 * The scale the round Tree's model (Tree.glb) is drawn at: 0.125 wide and
 * deep, 0.5 tall. One place for the single-entity tree, the crown and branch
 * batches and the branch snow, whose slope range is converted for this
 * squash (`snowPresets.treeBranches`), so they never drift apart. Shared by
 * reference, so never change it in place.
 */
export const treeEntityScale: Vector3Tuple = [0.125, 0.5, 0.125];
