import type { BufferGeometry, Mesh, Vector3Tuple } from 'three';
import { useGameState } from '../useGameState';

type RainWetOverlayProps = {
    raycast?: Mesh['raycast'];
    geometry: BufferGeometry;
    debugName?: string;
    minRain?: number;
    intensityMultiplier?: number;
    drySpeed?: number;
    wetSpeed?: number;
    topSurfaceBias?: number;
    darkness?: number;
    glossiness?: number;
    bounds?: {
        min: Vector3Tuple;
        max: Vector3Tuple;
    };
};

/**
 * Retired wet overlay. It drew a second copy of a mesh for a sheen of at
 * most 7% on its up-facing faces: per prop it cost about 30k triangles on a
 * full farm in rain, and the instanced copies on blocks another 24 draws and
 * 19k triangles for 0.1-0.2% of the pixels. Both are gone; the wet look
 * lives in the weather-integrated base-ground material
 * (`weatherSurfaceMaterial.ts`: saturation, roughness and the sky sheen),
 * with puddles and ripples on top. This component draws nothing; the call
 * sites keep their props.
 */
export function RainWetOverlay(_props: RainWetOverlayProps) {
    return null;
}

/**
 * Whether rain is strong enough to wet surfaces: it switches the integrated
 * wet look on base-ground blocks and pauses idle breathing.
 */
export function useRainWetOverlayVisible({
    intensityMultiplier = 1,
    minRain = 0.08,
}: Pick<RainWetOverlayProps, 'intensityMultiplier' | 'minRain'> = {}) {
    const rainAmount = useGameState((state) => state.rainSurfaceIntensity);

    return rainAmount * intensityMultiplier >= minRain;
}
