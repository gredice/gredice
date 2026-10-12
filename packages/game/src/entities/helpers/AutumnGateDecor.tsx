import type { Mesh } from 'three';
import { RainWetOverlay } from '../../rain/RainWetOverlay';
import { SnowOverlay } from '../../snow/SnowOverlay';
import { useGameState } from '../../useGameState';

const noRaycast = () => {};

/** Fixed composed decorations neither intercept pointer input nor follow the leaf hinge. */
export function AutumnGateDecor({ node }: { node: Mesh }) {
    const disabled = useGameState(
        (state) => state.weatherVisualizationDisabled,
    );
    return (
        <mesh
            name={node.name}
            geometry={node.geometry}
            material={node.material}
            raycast={noRaycast}
            castShadow
            receiveShadow
        >
            {!disabled && (
                <SnowOverlay
                    raycast={noRaycast}
                    geometry={node.geometry}
                    maxThickness={0.01}
                    coverageMultiplier={0.25}
                />
            )}
            {!disabled && (
                <RainWetOverlay
                    raycast={noRaycast}
                    geometry={node.geometry}
                    glossiness={0.12}
                />
            )}
        </mesh>
    );
}
