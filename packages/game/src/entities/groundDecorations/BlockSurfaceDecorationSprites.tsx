'use client';

import { useMemo } from 'react';
import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { SpriteAtlasBillboard } from '../../sprites/SpriteAtlasBillboard';
import type { Block } from '../../types/Block';
import { getBlockSurfaceDecorations } from './getBlockSurfaceDecorations';
import {
    type GroundDecorationSurface,
    groundDecorationAtlasBasePath,
} from './groundDecorationConfig';

type BlockSurfaceDecorationSpritesProps = {
    block: Block;
    surface: GroundDecorationSurface;
};

export function BlockSurfaceDecorationSprites({
    block,
    surface,
}: BlockSurfaceDecorationSpritesProps) {
    const { data: garden } = useCurrentGarden();
    const placements = useMemo(
        () =>
            getBlockSurfaceDecorations({
                block,
                gardenId: garden?.id,
                surface,
            }),
        [block, garden?.id, surface],
    );

    return placements.map((placement) => {
        const positionKey = placement.position
            .map((value) => value.toFixed(3))
            .join(':');

        return (
            <SpriteAtlasBillboard
                key={`${block.id}:${surface}:${placement.spriteName}:${positionKey}`}
                alphaTest={0.06}
                atlasBasePath={groundDecorationAtlasBasePath}
                height={placement.height}
                opacity={placement.opacity}
                position={placement.position}
                renderOrder={20}
                spriteName={placement.spriteName}
            />
        );
    });
}
