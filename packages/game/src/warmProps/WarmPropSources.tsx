import {
    createContext,
    type PropsWithChildren,
    type RefObject,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useState,
} from 'react';
import type { MeshStandardMaterial, Object3D } from 'three';

export type WarmPropSource = {
    id: string;
    kind: 'brazier' | 'cart';
    object: Object3D;
    anchors: readonly {
        id: string;
        position: [number, number, number];
        radius: number;
    }[];
    embers?: RefObject<MeshStandardMaterial | null>;
};

const emptySources: WarmPropSource[] = [];
const WarmPropContext = createContext({
    sources: emptySources,
    register:
        (_source: WarmPropSource): (() => void) =>
        () => {},
});

export function WarmPropSourcesProvider({ children }: PropsWithChildren) {
    const [sources, setSources] = useState(emptySources);
    const register = useCallback((source: WarmPropSource) => {
        setSources((previous) => [
            ...previous.filter((entry) => entry.id !== source.id),
            source,
        ]);
        return () => {
            if (source.embers?.current)
                source.embers.current.emissiveIntensity = 0;
            setSources((previous) =>
                previous.filter((entry) => entry !== source),
            );
        };
    }, []);
    const value = useMemo(() => ({ sources, register }), [sources, register]);
    return (
        <WarmPropContext.Provider value={value}>
            {children}
        </WarmPropContext.Provider>
    );
}

export function useWarmPropSources() {
    return useContext(WarmPropContext).sources;
}

export function useRegisterWarmProp({
    id,
    kind,
    ref,
    anchors,
    embers,
    disabled,
}: Omit<WarmPropSource, 'object'> & {
    ref: RefObject<Object3D | null>;
    disabled?: boolean;
}) {
    const { register } = useContext(WarmPropContext);
    useLayoutEffect(() => {
        if (!disabled && ref.current)
            return register({ id, kind, object: ref.current, anchors, embers });
    }, [id, kind, ref, anchors, embers, disabled, register]);
}
