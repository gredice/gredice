import { createContext, useContext, useLayoutEffect } from 'react';
import type { Material } from 'three';
import {
    type AutumnPropWindBinding,
    bindAutumnPropWindMaterial,
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
