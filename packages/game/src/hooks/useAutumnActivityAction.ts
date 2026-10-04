import {
    type AutumnActivityCommand,
    AutumnActivityRequestError,
    gardenPackInventoryKeys,
    readStoredAutumnActivityCommand,
    submitAutumnActivityAction,
} from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
    activityRefreshKey,
    autumnActivityKeys,
    type useAutumnActivity,
} from './useAutumnActivity';
import type { useCurrentUser } from './useCurrentUser';
import {
    type GardenAccountGroups,
    gardenAccountGroupsKeys,
} from './useGardenAccountGroups';

type Recovery = {
    command: AutumnActivityCommand | null;
    error: string | null;
    uncertain: boolean;
};
const storageKey = (owner: string) =>
    `gredice:pending-autumn-activity:v1:${owner}`;
function save(owner: string, command: AutumnActivityCommand | null) {
    try {
        if (command)
            sessionStorage.setItem(storageKey(owner), JSON.stringify(command));
        else sessionStorage.removeItem(storageKey(owner));
    } catch {
        /* Preserve the mounted command when browser storage is unavailable. */
    }
}
function load(owner: string) {
    try {
        const value = sessionStorage.getItem(storageKey(owner));
        return value
            ? readStoredAutumnActivityCommand(JSON.parse(value))
            : null;
    } catch {
        return null;
    }
}

export function useAutumnActivityAction(
    activity: ReturnType<typeof useAutumnActivity>,
) {
    const { context } = activity;
    const owner = JSON.stringify([context.userId, context.accountId]);
    const client = useQueryClient();
    const sessions = useRef(new Map<string, Recovery>());
    const busy = useRef(false);
    const [, render] = useState(0);
    if (context.eligible && !sessions.current.has(owner)) {
        const storedCommand = load(owner);
        const command =
            storedCommand?.expectedAccountId === context.accountId
                ? storedCommand
                : null;
        sessions.current.set(owner, {
            command,
            uncertain: Boolean(command),
            error: command
                ? 'Potvrda aktivnosti nije stigla. Provjeri isti zahtjev.'
                : null,
        });
    }
    const recovery = context.eligible ? sessions.current.get(owner) : undefined;
    const mutation = useMutation({
        mutationKey: [...autumnActivityKeys, 'action'],
        retry: false,
        mutationFn: async ({
            command,
            userId,
        }: {
            command: AutumnActivityCommand;
            userId: string | undefined;
        }) => {
            const accountId = client
                .getQueryData<GardenAccountGroups>(gardenAccountGroupsKeys)
                ?.find((group) => group.isCurrent)?.accountId;
            const user = client.getQueryData<
                ReturnType<typeof useCurrentUser>['data']
            >(['currentUser']);
            if (
                !context.eligible ||
                user?.id !== userId ||
                accountId !== command.expectedAccountId
            )
                throw new AutumnActivityRequestError(
                    409,
                    'EXPECTED_ACCOUNT_MISMATCH',
                    'Račun se promijenio. Vrati se na račun za ovaj album.',
                );
            return submitAutumnActivityAction(command);
        },
    });
    async function submit(action?: AutumnActivityCommand['action']) {
        if (
            !context.eligible ||
            !context.accountId ||
            !recovery ||
            busy.current
        )
            return;
        if (!recovery.command) {
            const campaign = activity.data?.campaign;
            if (!action || !campaign || !activity.data?.actionAvailable) return;
            recovery.command = {
                operationId: crypto.randomUUID(),
                expectedAccountId: context.accountId,
                campaignId: campaign.id,
                campaignVersionId: campaign.versionId,
                action,
            };
        }
        save(owner, recovery.command);
        recovery.error = null;
        busy.current = true;
        render((value) => value + 1);
        try {
            await mutation.mutateAsync({
                command: recovery.command,
                userId: context.userId,
            });
            // A receipt confirms this exact command; progress is refreshed from GET.
            recovery.command = null;
            recovery.uncertain = false;
            save(owner, null);
            void client.invalidateQueries({
                queryKey: [
                    ...autumnActivityKeys,
                    context.userId,
                    context.accountId,
                ],
            });
            void client.invalidateQueries({
                queryKey: gardenPackInventoryKeys.all,
            });
            try {
                localStorage.setItem(
                    activityRefreshKey(owner),
                    crypto.randomUUID(),
                );
            } catch {
                /* Focus/reconnect refresh remains available. */
            }
        } catch (error) {
            recovery.uncertain =
                !(error instanceof AutumnActivityRequestError) ||
                error.uncertain ||
                !error.serverDefinitive;
            recovery.error =
                error instanceof AutumnActivityRequestError
                    ? error.message
                    : 'Potvrda aktivnosti nije stigla. Provjeri isti zahtjev.';
            if (!recovery.uncertain) {
                recovery.command = null;
                save(owner, null);
                void activity.refetch();
            }
        } finally {
            busy.current = false;
            render((value) => value + 1);
        }
    }
    return { submit, recovery, isPending: mutation.isPending || busy.current };
}
