import { createContext, useContext, useLayoutEffect } from 'react';
import type { BufferGeometry, Material } from 'three';
import {
    type AutumnPropWindBinding,
    bindAutumnPropWindMaterial,
    padAutumnPropWindCullingBounds,
} from './autumnPropWind';

export const AutumnPropWindMaterialContext =
    createContext<AutumnPropWindBinding | null>(null);

/** Overlay materials are already scene-owned and disposed by their own hooks. */
export function useAutumnPropWindOverlay(material: Material) {
    const binding = useContext(AutumnPropWindMaterialContext);
    useLayoutEffect(() => {
        if (binding) return bindAutumnPropWindMaterial(material, binding);
    }, [binding, material]);
}

/** Derived overlay geometry sways with its prop, so it needs the same culling allowance. */
export function useAutumnPropWindOverlayGeometry(geometry: BufferGeometry) {
    const binding = useContext(AutumnPropWindMaterialContext);
    useLayoutEffect(() => {
        if (binding) padAutumnPropWindCullingBounds(geometry);
    }, [binding, geometry]);
}
