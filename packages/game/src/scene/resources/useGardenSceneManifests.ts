import { useMemo, useRef } from 'react';
import type { RetainedGardenScene } from '../compiler/retainedGardenScene';
import {
    collectGardenBlockNames,
    createGardenSceneManifest,
    type GardenSceneManifest,
} from './gardenSceneManifest';

type IncomingGarden = {
    readonly id: number;
    readonly stacks: readonly {
        readonly blocks: readonly { readonly name: string }[];
    }[];
};

/** Keeps manifest identity while its load work is unchanged. */
function useStableManifest(manifest: GardenSceneManifest | null) {
    const ref = useRef(manifest);
    if (
        manifest?.key !== ref.current?.key ||
        manifest?.gardenId !== ref.current?.gardenId
    ) {
        ref.current = manifest;
    }
    return ref.current;
}

/**
 * Manifests for the displayed garden (from retained chunk asset usage, so
 * placements only rebuild touched chunks) and for a garden that is fading in.
 */
export function useGardenSceneManifests({
    details,
    displayedGardenId,
    incomingGarden,
    retainedScene,
}: {
    details: boolean;
    /** `undefined` while nothing is displayed yet. */
    displayedGardenId: number | null | undefined;
    incomingGarden: IncomingGarden | null | undefined;
    retainedScene: RetainedGardenScene;
}) {
    const displayedBlockNames = useMemo(() => {
        const names = new Set<string>();
        for (const chunk of retainedScene.chunks) {
            for (const name of chunk.assetUsage.keys()) names.add(name);
        }
        return names;
    }, [retainedScene.chunks]);
    const current = useStableManifest(
        useMemo(
            () =>
                displayedGardenId === undefined
                    ? null
                    : createGardenSceneManifest({
                          blockNames: displayedBlockNames,
                          details,
                          gardenId: displayedGardenId,
                      }),
            [details, displayedBlockNames, displayedGardenId],
        ),
    );
    const incomingId = incomingGarden?.id;
    const incomingStacks = incomingGarden?.stacks;
    const next = useStableManifest(
        useMemo(
            () =>
                incomingId === undefined ||
                incomingId === displayedGardenId ||
                !incomingStacks
                    ? null
                    : createGardenSceneManifest({
                          blockNames: collectGardenBlockNames(incomingStacks),
                          details,
                          gardenId: incomingId,
                          priority: 'transition-next',
                      }),
            [details, displayedGardenId, incomingId, incomingStacks],
        ),
    );
    return { current, next };
}
