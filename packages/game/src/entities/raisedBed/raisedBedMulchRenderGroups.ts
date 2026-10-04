import type { MulchBlockName } from './mulchPatchGeometry';

export type RaisedBedMulchRenderPatch<TInstance> = {
    blockName: MulchBlockName;
    instance: TInstance;
    mask: number;
    scale: [number, number, number];
};

export type RaisedBedMulchRenderGroup<TInstance> = {
    blockName: MulchBlockName;
    instances: TInstance[];
    key: string;
    mask: number;
    scale: [number, number, number];
};

function raisedBedMulchRenderGroupKey(
    patch: RaisedBedMulchRenderPatch<unknown>,
) {
    return [
        patch.blockName,
        patch.mask,
        patch.scale[0],
        patch.scale[1],
        patch.scale[2],
    ].join(':');
}

export function getRaisedBedMulchRenderGroups<TInstance>(
    patches: readonly RaisedBedMulchRenderPatch<TInstance>[],
) {
    const groups = new Map<string, RaisedBedMulchRenderGroup<TInstance>>();

    for (const patch of patches) {
        const key = raisedBedMulchRenderGroupKey(patch);
        const group = groups.get(key);
        if (group) {
            group.instances.push(patch.instance);
            continue;
        }

        groups.set(key, {
            blockName: patch.blockName,
            instances: [patch.instance],
            key,
            mask: patch.mask,
            scale: patch.scale,
        });
    }

    return [...groups.values()];
}
