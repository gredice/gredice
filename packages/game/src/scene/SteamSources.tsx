import {
    createContext,
    type PropsWithChildren,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';
import type { Group } from 'three';

type SteamSource = { id: string; object: Group; radius: number };
const emptySources: SteamSource[] = [];
const SteamSourcesContext = createContext({
    sources: emptySources,
    register:
        (_source: SteamSource): (() => void) =>
        () => {},
});

/** Rendered prop anchors belong to one Canvas; cached GLTF nodes never register. */
export function SteamSourcesProvider({ children }: PropsWithChildren) {
    const [sources, setSources] = useState<SteamSource[]>([]);
    const register = useCallback((source: SteamSource) => {
        setSources((previous) =>
            [
                ...previous.filter((entry) => entry.id !== source.id),
                source,
            ].sort((a, b) => a.id.localeCompare(b.id)),
        );
        return () =>
            setSources((previous) =>
                previous.filter((entry) => entry !== source),
            );
    }, []);
    const value = useMemo(() => ({ sources, register }), [sources, register]);
    return (
        <SteamSourcesContext.Provider value={value}>
            {children}
        </SteamSourcesContext.Provider>
    );
}

export function useSteamSources() {
    return useContext(SteamSourcesContext);
}
