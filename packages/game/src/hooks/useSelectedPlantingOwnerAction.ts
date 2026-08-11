import { clientAuthenticated } from '@gredice/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SelectedPlantingOwnerLifecycleStatus } from '../hud/raisedBed/selectedPlantingOwnerActions';
import { currentAccountKeys } from './useCurrentAccount';
import { useGardensKeys } from './useGardens';
import { notificationsQueryKey } from './useNotifications';
import { queryKeys as raisedBedDiaryQueryKeys } from './useRaisedBedDiaryEntries';

export type SelectedPlantingOwnerActionTarget = {
    expectedLifecycleVersionEventId: number;
    expectedPlantSortId: number;
    plantingId: number;
};

export type SelectedPlantingOwnerAction =
    | {
          type: 'reschedule';
          scheduledDate: string;
          sowingLocation: 'direct' | 'greenhouse';
          target: SelectedPlantingOwnerActionTarget;
      }
    | {
          type: 'cancel';
          reason: string;
          target: SelectedPlantingOwnerActionTarget;
      }
    | {
          effectiveAt: string;
          type: 'updateStatus';
          status: SelectedPlantingOwnerLifecycleStatus;
          target: SelectedPlantingOwnerActionTarget;
      };

export type SelectedPlantingOwnerActionResult =
    | { type: 'reschedule' }
    | { refundAmount: number; type: 'cancel' }
    | { type: 'updateStatus' };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

async function getResponseErrorMessage(response: Response) {
    const fallbackMessage = 'Promjena sijanja nije uspjela.';
    const text = await response.text();
    if (!text.trim()) {
        return fallbackMessage;
    }
    try {
        const parsed: unknown = JSON.parse(text);
        if (
            isRecord(parsed) &&
            typeof parsed.error === 'string' &&
            parsed.error.trim()
        ) {
            return parsed.error;
        }
    } catch {
        return fallbackMessage;
    }
    return fallbackMessage;
}

function createCommandId() {
    if (typeof globalThis.crypto?.randomUUID !== 'function') {
        throw new Error(
            'Sigurna potvrda promjene nije dostupna. Osvježi aplikaciju i pokušaj ponovno.',
        );
    }
    return globalThis.crypto.randomUUID();
}

async function submitSelectedPlantingOwnerAction({
    action,
    gardenId,
    raisedBedId,
}: {
    action: SelectedPlantingOwnerAction;
    gardenId: number;
    raisedBedId: number;
}): Promise<SelectedPlantingOwnerActionResult> {
    const commandId = createCommandId();
    const route =
        clientAuthenticated().api.gardens[':gardenId']['raised-beds'][
            ':raisedBedId'
        ].plantings[':plantingId'];
    const param = {
        gardenId: gardenId.toString(),
        plantingId: action.target.plantingId.toString(),
        raisedBedId: raisedBedId.toString(),
    };
    const identity = {
        commandId,
        expectedLifecycleVersionEventId:
            action.target.expectedLifecycleVersionEventId,
        expectedPlantSortId: action.target.expectedPlantSortId,
    };

    if (action.type === 'reschedule') {
        const response = await route.reschedule.$post({
            param,
            json: {
                ...identity,
                scheduledDate: action.scheduledDate,
                sowingLocation: action.sowingLocation,
            },
        });
        if (response.status !== 200) {
            throw new Error(await getResponseErrorMessage(response));
        }
        return { type: 'reschedule' };
    }
    if (action.type === 'cancel') {
        const response = await route.cancel.$post({
            param,
            json: { ...identity, reason: action.reason },
        });
        if (response.status !== 200) {
            throw new Error(await getResponseErrorMessage(response));
        }
        const result: unknown = await response.json();
        const refundAmount =
            isRecord(result) &&
            typeof result.refundAmount === 'number' &&
            Number.isSafeInteger(result.refundAmount) &&
            result.refundAmount >= 0
                ? result.refundAmount
                : 0;
        return { refundAmount, type: 'cancel' };
    }
    const response = await route.$patch({
        param,
        json: {
            ...identity,
            effectiveAt: action.effectiveAt,
            status: action.status,
        },
    });
    if (response.status !== 200) {
        throw new Error(await getResponseErrorMessage(response));
    }
    return { type: 'updateStatus' };
}

export function useSelectedPlantingOwnerAction(
    gardenId: number,
    raisedBedId: number,
) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: [
            'gardens',
            gardenId,
            'raised-beds',
            raisedBedId,
            'selected-planting-owner-action',
        ],
        mutationFn: (action: SelectedPlantingOwnerAction) =>
            submitSelectedPlantingOwnerAction({
                action,
                gardenId,
                raisedBedId,
            }),
        onSuccess: async (_result, action) => {
            const invalidations = [
                queryClient.invalidateQueries({ queryKey: useGardensKeys }),
                queryClient.invalidateQueries({
                    queryKey: raisedBedDiaryQueryKeys.byId(raisedBedId),
                }),
            ];
            if (action.type === 'cancel') {
                invalidations.push(
                    queryClient.invalidateQueries({
                        queryKey: currentAccountKeys,
                    }),
                    queryClient.invalidateQueries({
                        queryKey: notificationsQueryKey,
                    }),
                );
            }
            await Promise.all(invalidations);
        },
    });
}
