'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useRef, useState } from 'react';
import {
    resolveExplicitGarden,
    resolvePreferredGarden,
} from './hooks/gardenSelection';
import {
    type GardenAccountGroups,
    gardenAccountGroupsKeys,
    useGardenAccountGroups,
} from './hooks/useGardenAccountGroups';
import { useGardensKeys } from './hooks/useGardens';
import { useSwitchGardenAccount } from './hooks/useSwitchGardenAccount';
import { useCurrentGardenIdParam } from './useUrlState';

export function GardenSelectionGate({
    children,
    disabled = false,
}: PropsWithChildren<{
    disabled?: boolean;
}>) {
    const queryClient = useQueryClient();
    const [selectedGardenId] = useCurrentGardenIdParam();
    const [selectionResolved, setSelectionResolved] = useState(disabled);
    const preferredAccountIdRef = useRef<string | null | undefined>(undefined);
    const switchingAccountIdRef = useRef<string | null>(null);
    const lastSelectedGardenIdRef = useRef(selectedGardenId);
    const {
        data: accountGroups,
        isError: accountGroupsError,
        isLoading: accountGroupsLoading,
    } = useGardenAccountGroups(disabled);
    const { mutate: switchGardenAccount } = useSwitchGardenAccount();

    if (
        preferredAccountIdRef.current === undefined &&
        accountGroups !== undefined
    ) {
        preferredAccountIdRef.current =
            resolvePreferredGarden(accountGroups, selectedGardenId)
                ?.accountId ?? null;
    }

    const preferredAccountId = preferredAccountIdRef.current;
    const preferredAccountIsCurrent = accountGroups?.some(
        (group) => group.accountId === preferredAccountId && group.isCurrent,
    );
    const targetAccountId =
        !selectionResolved &&
        preferredAccountId &&
        preferredAccountIsCurrent === false
            ? preferredAccountId
            : null;

    useEffect(() => {
        if (
            disabled ||
            !selectionResolved ||
            selectedGardenId === lastSelectedGardenIdRef.current
        ) {
            return;
        }

        if (selectedGardenId === null) {
            lastSelectedGardenIdRef.current = null;
            return;
        }

        const cachedAccountGroups =
            queryClient.getQueryData<GardenAccountGroups | null>(
                gardenAccountGroupsKeys,
            );
        const availableAccountGroups =
            cachedAccountGroups === undefined
                ? accountGroups
                : cachedAccountGroups;
        if (availableAccountGroups === undefined) {
            return;
        }

        const explicitGarden = resolveExplicitGarden(
            availableAccountGroups,
            selectedGardenId,
        );
        lastSelectedGardenIdRef.current = selectedGardenId;
        if (!explicitGarden || explicitGarden.isCurrent) {
            return;
        }

        preferredAccountIdRef.current = explicitGarden.accountId;
        switchingAccountIdRef.current = null;
        setSelectionResolved(false);
    }, [
        accountGroups,
        disabled,
        queryClient,
        selectedGardenId,
        selectionResolved,
    ]);

    useEffect(() => {
        if (disabled || selectionResolved) {
            return;
        }

        if (accountGroupsError) {
            setSelectionResolved(true);
            return;
        }

        if (accountGroupsLoading || preferredAccountId === undefined) {
            return;
        }

        if (!targetAccountId) {
            setSelectionResolved(true);
            return;
        }

        if (switchingAccountIdRef.current === targetAccountId) {
            return;
        }
        switchingAccountIdRef.current = targetAccountId;

        switchGardenAccount(
            { accountId: targetAccountId },
            {
                onError: (error) => {
                    console.error(
                        'Failed to switch to the preferred garden account:',
                        error,
                    );
                    switchingAccountIdRef.current = null;
                    setSelectionResolved(true);
                },
                onSuccess: () => {
                    queryClient.setQueryData<GardenAccountGroups>(
                        gardenAccountGroupsKeys,
                        (groups) =>
                            groups?.map((group) => ({
                                ...group,
                                isCurrent: group.accountId === targetAccountId,
                            })),
                    );
                    void queryClient.invalidateQueries({
                        exact: true,
                        queryKey: useGardensKeys,
                    });
                    switchingAccountIdRef.current = null;
                    setSelectionResolved(true);
                },
            },
        );
    }, [
        accountGroupsError,
        accountGroupsLoading,
        disabled,
        preferredAccountId,
        queryClient,
        selectionResolved,
        switchGardenAccount,
        targetAccountId,
    ]);

    const isResolvingSelection =
        !disabled && !selectionResolved && !accountGroupsError;

    return isResolvingSelection ? null : children;
}
