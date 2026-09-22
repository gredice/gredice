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
import type { Object3D } from 'three';
import type { AutumnPartLeafSurface } from '../entities/helpers/autumnLeafSurfaces';

export type AutumnRegisteredPart = {
    blockId: string;
    partId: string;
    coordinateSpace: 'part-local';
    eligibilityPolicy: 'always' | 'closed-and-settled';
    object: Object3D;
    surfaces: readonly AutumnPartLeafSurface[];
    eligible: boolean;
    covered: boolean;
};

const emptyParts: AutumnRegisteredPart[] = [];
const AutumnPartsContext = createContext({
    parts: emptyParts,
    register:
        (_part: AutumnRegisteredPart): (() => void) =>
        () => {},
});

/** Render ownership is scene-local. Replacing a logical part during a drag
 * handoff removes the old owner without changing its seeded identity.
 */
export function AutumnPartsProvider({ children }: PropsWithChildren) {
    const [parts, setParts] = useState<AutumnRegisteredPart[]>([]);
    const register = useCallback((part: AutumnRegisteredPart) => {
        setParts((previous) =>
            [
                ...previous.filter(
                    (entry) =>
                        entry.blockId !== part.blockId ||
                        entry.partId !== part.partId,
                ),
                part,
            ].sort(
                (a, b) =>
                    a.blockId.localeCompare(b.blockId) ||
                    a.partId.localeCompare(b.partId),
            ),
        );
        return () =>
            setParts((previous) => previous.filter((entry) => entry !== part));
    }, []);
    const value = useMemo(() => ({ parts, register }), [parts, register]);
    return (
        <AutumnPartsContext.Provider value={value}>
            {children}
        </AutumnPartsContext.Provider>
    );
}

export function useAutumnParts() {
    return useContext(AutumnPartsContext).parts;
}

export function useRegisterAutumnPart({
    blockId,
    partId,
    ref,
    surfaces,
    eligible = true,
    covered = false,
    eligibilityPolicy = 'always',
}: {
    blockId: string;
    partId: string;
    ref: RefObject<Object3D | null>;
    surfaces: readonly AutumnPartLeafSurface[];
    eligible?: boolean;
    covered?: boolean;
    eligibilityPolicy?: AutumnRegisteredPart['eligibilityPolicy'];
}) {
    const { register } = useContext(AutumnPartsContext);
    useLayoutEffect(() => {
        if (ref.current && surfaces.length > 0)
            return register({
                blockId,
                partId,
                coordinateSpace: 'part-local',
                eligibilityPolicy,
                object: ref.current,
                surfaces,
                eligible,
                covered,
            });
    }, [
        blockId,
        partId,
        ref,
        surfaces,
        eligible,
        covered,
        eligibilityPolicy,
        register,
    ]);
}
