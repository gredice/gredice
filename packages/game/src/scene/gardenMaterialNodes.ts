import {
    isValidElement,
    type ReactNode,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react';
import {
    BackSide,
    Color,
    DoubleSide,
    FrontSide,
    MeshStandardMaterial,
    type MeshStandardMaterialParameters,
} from 'three';

/** Only constructor values with the same semantics as their R3F material props qualify. */
export function readStaticGardenMaterialNode(node: ReactNode) {
    if (!isValidElement(node) || node.type !== 'meshStandardMaterial')
        return undefined;
    const props = node.props;
    if (typeof props !== 'object' || props === null) return undefined;
    const parameters: MeshStandardMaterialParameters = {};
    for (const key of Object.keys(props).sort()) {
        const value: unknown = Reflect.get(props, key);
        switch (key) {
            case 'color':
            case 'emissive':
                if (
                    typeof value !== 'string' &&
                    typeof value !== 'number' &&
                    !(value instanceof Color)
                )
                    return undefined;
                parameters[key] = value;
                break;
            case 'roughness':
            case 'metalness':
            case 'emissiveIntensity':
            case 'opacity':
            case 'alphaTest':
                if (typeof value !== 'number' || !Number.isFinite(value))
                    return undefined;
                parameters[key] = value;
                break;
            case 'side':
                if (
                    value !== FrontSide &&
                    value !== BackSide &&
                    value !== DoubleSide
                )
                    return undefined;
                parameters.side = value;
                break;
            case 'depthTest':
            case 'depthWrite':
            case 'toneMapped':
            case 'flatShading':
            case 'vertexColors':
                if (typeof value !== 'boolean') return undefined;
                parameters[key] = value;
                break;
            case 'transparent':
                // Sorted transparency stays owned and rendered by the authored JSX path.
                if (value !== false) return undefined;
                parameters.transparent = value;
                break;
            default:
                // Refs, args, children, custom hooks and other props keep their original lifecycle.
                return undefined;
        }
    }
    return parameters;
}

/** Commit-owned source material; StrictMode replay allocates a fresh lease after cleanup. */
export function useStaticGardenMaterialNode(node: ReactNode, enabled: boolean) {
    const parameters = enabled ? readStaticGardenMaterialNode(node) : undefined;
    const key = parameters
        ? JSON.stringify(
              Object.entries(parameters).map(([name, value]) => [
                  name,
                  value instanceof Color ? [value.r, value.g, value.b] : value,
              ]),
          )
        : undefined;
    // biome-ignore lint/correctness/useExhaustiveDependencies: key observes every supported constructor value.
    const stableParameters = useMemo(() => parameters, [key]);
    const [leased, setLeased] = useState<{
        key: string;
        material: MeshStandardMaterial;
    }>();
    useLayoutEffect(() => {
        if (!key || !stableParameters) return;
        const material = new MeshStandardMaterial(stableParameters);
        setLeased({ key, material });
        return () => material.dispose();
    }, [key, stableParameters]);
    return key && leased?.key === key ? leased.material : undefined;
}
