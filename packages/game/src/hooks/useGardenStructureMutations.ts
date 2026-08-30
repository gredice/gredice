import { clientAuthenticated } from '@gredice/client';
import {
    decodeGardenStructureDocument,
    type GardenStructureDocumentV1,
    type GardenStructureRotation,
    type GardenStructureTemplateKey,
    normalizeGardenStructureDocument,
} from '@gredice/js/gardenStructures';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { GardenStructureEditorState } from '../structures/editor';
import { useGameState } from '../useGameState';
import { currentAccountKeys } from './useCurrentAccount';
import { currentGardenKeys } from './useCurrentGarden';

export type GardenStructureMutationResult = Readonly<{
    economy: Readonly<{
        debitedSunflowers: number;
        refundedSunflowers: number;
    }>;
    kind: 'create' | 'delete' | 'placement' | 'replace' | 'resize';
    structure: Readonly<{
        anchorX: number;
        anchorY: number;
        deleted: boolean;
        document: GardenStructureDocumentV1;
        gardenId: number;
        id: string;
        kitKey: string;
        kitVersion: string;
        pricingVersion: number;
        refundableSunflowerPrincipal: number;
        revision: number;
        rotation: GardenStructureRotation;
        sunflowerPricePerCell: number;
        templateKey: GardenStructureTemplateKey;
    }>;
}>;

export class GardenStructureMutationClientError extends Error {
    override readonly name = 'GardenStructureMutationClientError';

    constructor(
        message: string,
        readonly code: string,
        readonly outcome: 'rejected' | 'unknown',
        readonly currentRevision: number | null = null,
    ) {
        super(message);
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    );
}

function isPositiveSafeInteger(value: unknown): value is number {
    return (
        typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    );
}

function isRotation(value: unknown): value is GardenStructureRotation {
    return value === 0 || value === 1 || value === 2 || value === 3;
}

function isTemplateKey(value: unknown): value is GardenStructureTemplateKey {
    return (
        value === 'barn' ||
        value === 'house' ||
        value === 'greenhouse' ||
        value === 'blank'
    );
}

function decodeMutationResult(value: unknown): GardenStructureMutationResult {
    if (
        !isRecord(value) ||
        !isRecord(value.economy) ||
        !isRecord(value.structure)
    ) {
        throw new GardenStructureMutationClientError(
            'Poslužitelj je vratio neispravan odgovor za građevinu.',
            'INVALID_RESPONSE',
            'unknown',
        );
    }

    const { economy, kind, structure } = value;
    const document = decodeGardenStructureDocument(structure.document);
    if (
        (kind !== 'create' &&
            kind !== 'delete' &&
            kind !== 'placement' &&
            kind !== 'replace' &&
            kind !== 'resize') ||
        !isNonNegativeSafeInteger(economy.debitedSunflowers) ||
        !isNonNegativeSafeInteger(economy.refundedSunflowers) ||
        typeof structure.id !== 'string' ||
        typeof structure.kitKey !== 'string' ||
        typeof structure.kitVersion !== 'string' ||
        typeof structure.deleted !== 'boolean' ||
        !isPositiveSafeInteger(structure.gardenId) ||
        !Number.isSafeInteger(structure.anchorX) ||
        !Number.isSafeInteger(structure.anchorY) ||
        !isRotation(structure.rotation) ||
        !isPositiveSafeInteger(structure.revision) ||
        !isPositiveSafeInteger(structure.pricingVersion) ||
        !isNonNegativeSafeInteger(structure.sunflowerPricePerCell) ||
        !isNonNegativeSafeInteger(structure.refundableSunflowerPrincipal) ||
        !isTemplateKey(structure.templateKey) ||
        !document.valid
    ) {
        throw new GardenStructureMutationClientError(
            'Poslužitelj je vratio neispravan odgovor za građevinu.',
            'INVALID_RESPONSE',
            'unknown',
        );
    }

    return {
        economy: {
            debitedSunflowers: economy.debitedSunflowers,
            refundedSunflowers: economy.refundedSunflowers,
        },
        kind,
        structure: {
            anchorX: Number(structure.anchorX),
            anchorY: Number(structure.anchorY),
            deleted: structure.deleted,
            document: normalizeGardenStructureDocument(document.document),
            gardenId: structure.gardenId,
            id: structure.id,
            kitKey: structure.kitKey,
            kitVersion: structure.kitVersion,
            pricingVersion: structure.pricingVersion,
            refundableSunflowerPrincipal:
                structure.refundableSunflowerPrincipal,
            revision: structure.revision,
            rotation: structure.rotation,
            sunflowerPricePerCell: structure.sunflowerPricePerCell,
            templateKey: structure.templateKey,
        },
    };
}

async function responseFailure(response: Response) {
    let value: unknown;
    try {
        value = await response.json();
    } catch {
        value = null;
    }
    const details =
        isRecord(value) && isRecord(value.details) ? value.details : null;
    const currentRevision = isPositiveSafeInteger(details?.currentRevision)
        ? details.currentRevision
        : null;
    const code =
        isRecord(value) &&
        typeof value.code === 'string' &&
        value.code.length <= 96
            ? value.code
            : `HTTP_${response.status.toString()}`;
    const message =
        isRecord(value) &&
        typeof value.error === 'string' &&
        value.error.length <= 512
            ? value.error
            : 'Građevinu trenutačno nije moguće spremiti.';
    return new GardenStructureMutationClientError(
        message,
        code,
        'rejected',
        currentRevision,
    );
}

function savingState(state: GardenStructureEditorState) {
    if (state.save.status !== 'saving') {
        throw new GardenStructureMutationClientError(
            'Promjena nije spremna za slanje.',
            'INVALID_EDITOR_STATE',
            'rejected',
        );
    }
    return state.save;
}

async function executeGardenStructureSave(
    state: GardenStructureEditorState,
): Promise<GardenStructureMutationResult> {
    const save = savingState(state);
    const structureId =
        state.origin.kind === 'new-draft'
            ? state.origin.draftId
            : state.origin.structureId;
    const gardenId = state.origin.gardenId.toString();
    const client = clientAuthenticated().api.gardens[':gardenId'].structures;

    try {
        let response: Response;
        switch (save.operation) {
            case 'create':
                response = await client.$post({
                    param: { gardenId },
                    json: {
                        operationId: save.operationId,
                        structureId,
                        templateKey: state.origin.templateKey,
                        kitKey: state.origin.kitKey,
                        kitVersion: state.origin.kitVersion,
                        anchorX: save.submittedSnapshot.placement.anchorX,
                        anchorY: save.submittedSnapshot.placement.anchorY,
                        rotation: save.submittedSnapshot.placement.rotation,
                        document: save.submittedSnapshot.document,
                    },
                });
                break;
            case 'replace-document':
                if (save.expectedRevision === null) {
                    throw new GardenStructureMutationClientError(
                        'Nedostaje revizija građevine.',
                        'INVALID_EDITOR_STATE',
                        'rejected',
                    );
                }
                response = await client[':structureId'].$put({
                    param: { gardenId, structureId },
                    json: {
                        operationId: save.operationId,
                        expectedRevision: save.expectedRevision,
                        document: save.submittedSnapshot.document,
                    },
                });
                break;
            case 'resize':
                if (save.expectedRevision === null) {
                    throw new GardenStructureMutationClientError(
                        'Nedostaje revizija građevine.',
                        'INVALID_EDITOR_STATE',
                        'rejected',
                    );
                }
                response = await client[':structureId'].resize.$post({
                    param: { gardenId, structureId },
                    json: {
                        operationId: save.operationId,
                        expectedRevision: save.expectedRevision,
                        document: save.submittedSnapshot.document,
                    },
                });
                break;
            case 'placement':
                if (save.expectedRevision === null) {
                    throw new GardenStructureMutationClientError(
                        'Nedostaje revizija građevine.',
                        'INVALID_EDITOR_STATE',
                        'rejected',
                    );
                }
                response = await client[':structureId'].placement.$patch({
                    param: { gardenId, structureId },
                    json: {
                        operationId: save.operationId,
                        expectedRevision: save.expectedRevision,
                        anchorX: save.submittedSnapshot.placement.anchorX,
                        anchorY: save.submittedSnapshot.placement.anchorY,
                        rotation: save.submittedSnapshot.placement.rotation,
                    },
                });
                break;
        }
        if (!response.ok) {
            throw await responseFailure(response);
        }
        return decodeMutationResult(await response.json());
    } catch (error) {
        if (error instanceof GardenStructureMutationClientError) {
            throw error;
        }
        throw new GardenStructureMutationClientError(
            'Veza je prekinuta prije potvrde spremanja. Nacrt je sačuvan lokalno.',
            'NETWORK_ERROR',
            'unknown',
        );
    }
}

async function executeGardenStructureDelete(input: {
    expectedRevision: number;
    gardenId: number;
    operationId: string;
    structureId: string;
}): Promise<GardenStructureMutationResult> {
    try {
        const response = await clientAuthenticated().api.gardens[
            ':gardenId'
        ].structures[':structureId'].$delete({
            param: {
                gardenId: input.gardenId.toString(),
                structureId: input.structureId,
            },
            json: {
                operationId: input.operationId,
                expectedRevision: input.expectedRevision,
            },
        });
        if (!response.ok) {
            throw await responseFailure(response);
        }
        return decodeMutationResult(await response.json());
    } catch (error) {
        if (error instanceof GardenStructureMutationClientError) {
            throw error;
        }
        throw new GardenStructureMutationClientError(
            'Veza je prekinuta prije potvrde rušenja. Građevina nije označena kao srušena.',
            'NETWORK_ERROR',
            'unknown',
        );
    }
}

export function useGardenStructureMutations(gardenId?: number) {
    const queryClient = useQueryClient();
    const winterMode = useGameState((state) => state.winterMode);
    const localSandboxStorageKey = useGameState(
        (state) => state.localSandboxStorageKey,
    );
    const gardenQueryKey = currentGardenKeys(
        winterMode,
        gardenId,
        undefined,
        localSandboxStorageKey,
    );
    const refreshAcknowledgedState = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: gardenQueryKey }),
            queryClient.invalidateQueries({ queryKey: currentAccountKeys }),
        ]);
    };

    const save = useMutation({
        mutationKey: ['gardens', gardenId, 'structures', 'save'],
        mutationFn: executeGardenStructureSave,
        onSuccess: refreshAcknowledgedState,
    });
    const demolish = useMutation({
        mutationKey: ['gardens', gardenId, 'structures', 'delete'],
        mutationFn: executeGardenStructureDelete,
        onSuccess: refreshAcknowledgedState,
    });

    return { demolish, save };
}
