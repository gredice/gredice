'use client';

import {
    createContext,
    createElement,
    type ReactNode,
    useCallback,
    useContext,
    useRef,
    useState,
} from 'react';
import type { Operation, RaisedBedField } from './types';

export type OperationOptimisticPatch = Partial<
    Pick<
        Operation,
        | 'assignedUser'
        | 'assignedUserId'
        | 'assignedUserIds'
        | 'assignedUsers'
        | 'completionNotes'
        | 'imageUrls'
        | 'isAccepted'
        | 'scheduledDate'
        | 'status'
    >
>;

export type RaisedBedFieldOptimisticPatch = Partial<
    Pick<
        RaisedBedField,
        | 'assignedUserId'
        | 'assignedUserIds'
        | 'isDeleted'
        | 'plantScheduledDate'
        | 'plantStatus'
    >
>;

type PatchEntry<TPatch> = {
    token: number;
    patch: TPatch;
};

type PatchTarget<TPatch> = {
    id: number;
    patch: TPatch;
};

type OptimisticScheduleAction = {
    operationPatches?: PatchTarget<OperationOptimisticPatch>[];
    fieldPatches?: PatchTarget<RaisedBedFieldOptimisticPatch>[];
    action: () => Promise<unknown>;
    errorLogMessage: string;
    errorAlertMessage: string;
};

function addPatchEntries<TPatch>(
    currentEntriesById: Map<number, PatchEntry<TPatch>[]>,
    patches: PatchTarget<TPatch>[],
    token: number,
) {
    if (patches.length === 0) {
        return currentEntriesById;
    }

    const nextEntriesById = new Map(currentEntriesById);
    for (const { id, patch } of patches) {
        nextEntriesById.set(id, [
            ...(nextEntriesById.get(id) ?? []),
            { token, patch },
        ]);
    }

    return nextEntriesById;
}

function removePatchToken<TPatch>(
    currentEntriesById: Map<number, PatchEntry<TPatch>[]>,
    token: number,
) {
    const nextEntriesById = new Map<number, PatchEntry<TPatch>[]>();

    for (const [id, entries] of currentEntriesById) {
        const nextEntries = entries.filter((entry) => entry.token !== token);
        if (nextEntries.length > 0) {
            nextEntriesById.set(id, nextEntries);
        }
    }

    return nextEntriesById;
}

function mergePatchEntries<TPatch extends object>(
    entries: PatchEntry<TPatch>[] | undefined,
) {
    if (!entries?.length) {
        return undefined;
    }

    const mergedPatch: Partial<TPatch> = {};
    for (const entry of entries) {
        Object.assign(mergedPatch, entry.patch);
    }

    return mergedPatch;
}

type OptimisticScheduleActionsContextValue = {
    getFieldPatch: (
        fieldId: number,
    ) => RaisedBedFieldOptimisticPatch | undefined;
    getOperationPatch: (
        operationId: number,
    ) => OperationOptimisticPatch | undefined;
    runOptimisticAction: (action: OptimisticScheduleAction) => void;
};

const OptimisticScheduleActionsContext =
    createContext<OptimisticScheduleActionsContextValue | null>(null);

function useOptimisticScheduleActionState(): OptimisticScheduleActionsContextValue {
    const tokenRef = useRef(0);
    const [operationEntriesById, setOperationEntriesById] = useState<
        Map<number, PatchEntry<OperationOptimisticPatch>[]>
    >(() => new Map());
    const [fieldEntriesById, setFieldEntriesById] = useState<
        Map<number, PatchEntry<RaisedBedFieldOptimisticPatch>[]>
    >(() => new Map());

    const runOptimisticAction = useCallback(
        ({
            operationPatches = [],
            fieldPatches = [],
            action,
            errorLogMessage,
            errorAlertMessage,
        }: OptimisticScheduleAction) => {
            const token = tokenRef.current;
            tokenRef.current += 1;

            setOperationEntriesById((currentEntriesById) =>
                addPatchEntries(currentEntriesById, operationPatches, token),
            );
            setFieldEntriesById((currentEntriesById) =>
                addPatchEntries(currentEntriesById, fieldPatches, token),
            );

            void Promise.resolve()
                .then(action)
                .catch((error: unknown) => {
                    console.error(errorLogMessage, error);
                    setOperationEntriesById((currentEntriesById) =>
                        removePatchToken(currentEntriesById, token),
                    );
                    setFieldEntriesById((currentEntriesById) =>
                        removePatchToken(currentEntriesById, token),
                    );
                    alert(errorAlertMessage);
                });
        },
        [],
    );

    const getOperationPatch = useCallback(
        (operationId: number) =>
            mergePatchEntries(operationEntriesById.get(operationId)),
        [operationEntriesById],
    );

    const getFieldPatch = useCallback(
        (fieldId: number) => mergePatchEntries(fieldEntriesById.get(fieldId)),
        [fieldEntriesById],
    );

    return {
        getFieldPatch,
        getOperationPatch,
        runOptimisticAction,
    };
}

export function OptimisticScheduleActionsProvider({
    children,
}: {
    children: ReactNode;
}) {
    const actions = useOptimisticScheduleActionState();

    return createElement(
        OptimisticScheduleActionsContext.Provider,
        { value: actions },
        children,
    );
}

export function useOptimisticScheduleActions() {
    const contextActions = useContext(OptimisticScheduleActionsContext);
    const localActions = useOptimisticScheduleActionState();

    return contextActions ?? localActions;
}
