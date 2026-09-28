import { type ComponentProps, useLayoutEffect, useMemo } from 'react';
import {
    MeshDepthMaterial,
    MeshDistanceMaterial,
    RGBADepthPacking,
} from 'three';
import { AutumnPropWindMaterialContext } from '../../scene/AutumnPropWindMaterial';
import { useAutumnPropWind } from '../../scene/AutumnPropWindProvider';
import {
    type AutumnPropWindRole,
    bindAutumnPropWindMaterial,
    createAutumnPropWindUniforms,
} from '../../scene/autumnPropWind';
import { WeatheredEntityPart } from './WeatheredEntityPart';

export function WindWeatheredEntityPart({
    node,
    windRole,
    seed,
    disabled = false,
    ...props
}: Omit<ComponentProps<typeof WeatheredEntityPart>, 'material'> & {
    windRole: AutumnPropWindRole;
    seed: string;
    disabled?: boolean;
}) {
    const wind = useAutumnPropWind();
    const binding = useMemo(
        () =>
            wind && !disabled
                ? {
                      role: windRole,
                      uniforms: createAutumnPropWindUniforms(
                          wind.time,
                          wind.strength,
                          wind.direction,
                          seed,
                      ),
                  }
                : null,
        [wind, disabled, windRole, seed],
    );
    const owned = useMemo(() => {
        if (!binding) return null;
        const clone = node.clone(false);
        // Keep shader motion inside conservative culling bounds without changing
        // source vertices or raycast targets, including during entity rotation.
        clone.geometry = node.geometry.clone();
        clone.geometry.computeBoundingBox();
        clone.geometry.computeBoundingSphere();
        if (clone.geometry.boundingSphere)
            clone.geometry.boundingSphere.radius += 0.04;
        clone.material = Array.isArray(node.material)
            ? node.material.map((material) => material.clone())
            : node.material.clone();
        clone.customDepthMaterial = new MeshDepthMaterial({
            depthPacking: RGBADepthPacking,
        });
        clone.customDistanceMaterial = new MeshDistanceMaterial();
        for (const material of [
            ...(Array.isArray(clone.material)
                ? clone.material
                : [clone.material]),
            clone.customDepthMaterial,
            clone.customDistanceMaterial,
        ])
            bindAutumnPropWindMaterial(material, binding);
        return clone;
    }, [node, binding]);
    useLayoutEffect(() => {
        if (binding) return wind?.register();
    }, [binding, wind]);
    useLayoutEffect(
        () => () => {
            if (!owned) return;
            for (const material of Array.isArray(owned.material)
                ? owned.material
                : [owned.material])
                material.dispose();
            owned.geometry.dispose();
            owned.customDepthMaterial?.dispose();
            owned.customDistanceMaterial?.dispose();
        },
        [owned],
    );
    return (
        <AutumnPropWindMaterialContext.Provider value={binding}>
            <WeatheredEntityPart
                {...props}
                node={owned ?? node}
                material={(owned ?? node).material}
            />
        </AutumnPropWindMaterialContext.Provider>
    );
}
