import {
    createContext,
    type PropsWithChildren,
    useContext,
    useEffect,
    useMemo,
    useSyncExternalStore,
} from 'react';
import type { Object3D } from 'three';

export class BreathSourceRegistry {
    private sources = new Map<string, Object3D>();
    private snapshot: readonly { id: string; head: Object3D }[] = [];
    private listeners = new Set<() => void>();
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    getSnapshot = () => this.snapshot;
    private publish() {
        this.snapshot = Array.from(this.sources, ([id, head]) => ({
            id,
            head,
        })).sort((a, b) => a.id.localeCompare(b.id));
        for (const listener of this.listeners) listener();
    }
    register(id: string, head: Object3D) {
        this.sources.set(id, head);
        this.publish();
        return () => {
            if (this.sources.get(id) !== head) return;
            this.sources.delete(id);
            this.publish();
        };
    }
}
const Context = createContext<BreathSourceRegistry | null>(null);
const emptyRegistry = new BreathSourceRegistry();

export function BreathSourcesProvider({ children }: PropsWithChildren) {
    const registry = useMemo(() => new BreathSourceRegistry(), []);
    return <Context.Provider value={registry}>{children}</Context.Provider>;
}

export function useBreathSource(
    id: string,
    head: Object3D | null,
    enabled: boolean,
) {
    const registry = useContext(Context);
    useEffect(() => {
        if (enabled && head && registry) return registry.register(id, head);
    }, [enabled, head, id, registry]);
}

export function useBreathSources() {
    const registry = useContext(Context) ?? emptyRegistry;
    return useSyncExternalStore(
        registry.subscribe,
        registry.getSnapshot,
        registry.getSnapshot,
    );
}
