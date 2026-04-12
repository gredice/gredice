'use client';

import { Billboard } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { PlaneGeometry } from 'three';
import { resolveSpriteAtlasAssetPaths } from './resolveSpriteAtlasAssetPaths';
import type { SpriteAtlasPage } from './types';
import { useSpriteAtlasManifest } from './useSpriteAtlasManifest';
import { useSpriteAtlasTexture } from './useSpriteAtlasTexture';

type SpriteAtlasBillboardProps = {
    alphaTest?: number;
    atlasBasePath: string;
    depthWrite?: boolean;
    follow?: boolean;
    height?: number;
    opacity?: number;
    position?: [number, number, number];
    renderOrder?: number;
    spriteName: string;
};

function resolvePageBasePath(atlasBasePath: string, pageIndex: number) {
    return pageIndex === 0 ? atlasBasePath : `${atlasBasePath}.${pageIndex}`;
}

export function SpriteAtlasBillboard({
    alphaTest = 0.05,
    atlasBasePath,
    depthWrite = false,
    follow = true,
    height = 1,
    opacity = 1,
    position = [0, 0, 0],
    renderOrder,
    spriteName,
}: SpriteAtlasBillboardProps) {
    const assetPaths = useMemo(
        () => resolveSpriteAtlasAssetPaths(atlasBasePath),
        [atlasBasePath],
    );
    const { error: manifestError, manifest } = useSpriteAtlasManifest(
        assetPaths.manifestUrl,
    );
    const sprite = manifest?.sprites[spriteName];
    const atlasPage = useMemo(() => {
        if (!manifest || !sprite) {
            return null;
        }

        if (manifest.pages && manifest.pages.length > 0) {
            const spritePageIndex = sprite.page ?? 0;
            return (
                manifest.pages.find((page) => page.index === spritePageIndex) ??
                manifest.pages[spritePageIndex] ??
                null
            );
        }

        if (!manifest.atlas) {
            return null;
        }

        return {
            atlas: manifest.atlas,
            index: 0,
            spriteCount: Object.keys(manifest.sprites).length,
        } satisfies SpriteAtlasPage;
    }, [manifest, sprite]);
    const pageAssetPaths = useMemo(
        () =>
            atlasPage
                ? resolveSpriteAtlasAssetPaths(
                      resolvePageBasePath(atlasBasePath, atlasPage.index),
                  )
                : null,
        [atlasBasePath, atlasPage],
    );
    const { error: textureError, texture } =
        useSpriteAtlasTexture(pageAssetPaths);

    const geometry = useMemo(() => {
        if (!atlasPage || !sprite) {
            return null;
        }

        const atlas = atlasPage.atlas;
        const planeGeometry = new PlaneGeometry(height * sprite.aspect, height);
        planeGeometry.translate(0, height / 2, 0);
        const u0 = sprite.frame.x / atlas.width;
        const u1 = (sprite.frame.x + sprite.frame.width) / atlas.width;
        const v0 = 1 - (sprite.frame.y + sprite.frame.height) / atlas.height;
        const v1 = 1 - sprite.frame.y / atlas.height;
        const uv = planeGeometry.getAttribute('uv');

        uv.setXY(0, u0, v1);
        uv.setXY(1, u1, v1);
        uv.setXY(2, u0, v0);
        uv.setXY(3, u1, v0);
        uv.needsUpdate = true;

        return planeGeometry;
    }, [atlasPage, height, sprite]);

    useEffect(() => {
        return () => {
            geometry?.dispose();
        };
    }, [geometry]);

    if (manifestError) {
        throw manifestError;
    }

    if (textureError) {
        throw textureError;
    }

    if (!manifest) {
        return null;
    }

    if (!sprite) {
        throw new Error(
            `Sprite "${spriteName}" was not found in atlas "${atlasBasePath}".`,
        );
    }

    if (!texture || !geometry) {
        return null;
    }

    return (
        <Billboard follow={follow} lockX lockZ position={position}>
            <mesh renderOrder={renderOrder}>
                <primitive attach="geometry" object={geometry} />
                <meshBasicMaterial
                    alphaTest={alphaTest}
                    depthWrite={depthWrite}
                    map={texture}
                    opacity={opacity}
                    toneMapped={false}
                    transparent
                />
            </mesh>
        </Billboard>
    );
}
