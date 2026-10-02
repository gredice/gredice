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
import type { Group } from 'three';
import { LeafStepCoverageProvider } from '../audio/LeafStepCoverageProvider';

type AutumnSource = { id: string; object: Group; kind?: 'tree' | 'bush' };
const emptySources: AutumnSource[] = [];
const AutumnSourcesContext = createContext({
    sources: emptySources,
    register:
        (_source: AutumnSource): (() => void) =>
        () => {},
});

/** Scene-local anchors: only mounted deciduous trees and bushes participate. */
export function AutumnSourcesProvider({ children }: PropsWithChildren) {
    const [sources, setSources] = useState<AutumnSource[]>([]);
    const register = useCallback((source: AutumnSource) => {
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
        <AutumnSourcesContext.Provider value={value}>
            <LeafStepCoverageProvider>{children}</LeafStepCoverageProvider>
        </AutumnSourcesContext.Provider>
    );
}

export function useAutumnSources() {
    return useContext(AutumnSourcesContext).sources;
}

export function useRegisterAutumnSources() {
    return useContext(AutumnSourcesContext).register;
}

export function useRegisterAutumnSource(
    id: string,
    ref: RefObject<Group | null>,
    enabled: boolean,
    kind: 'tree' | 'bush' = 'tree',
) {
    const { register } = useContext(AutumnSourcesContext);
    useLayoutEffect(() => {
        if (enabled && ref.current)
            return register({ id, object: ref.current, kind });
    }, [enabled, id, ref, register, kind]);
}
