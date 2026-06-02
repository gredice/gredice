import {
    calculatePlantsPerField,
    getImageObservablePlantStatusTargets,
    imageObservablePlantFieldStatuses,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import { validateHostedImageUrl } from '@gredice/js/urls';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { EntityStandardized } from '../@types/EntityStandardized';
import { createPlantStatusApprovalRequest } from '../repositories/approvalRequestsRepo';
import { getEntitiesFormatted } from '../repositories/entitiesRepo';
import { knownEventTypes } from '../repositories/events';
import { getRaisedBed } from '../repositories/gardensRepo';
import { getOperationById } from '../repositories/operationsRepo';
import type { AutomationJsonObject } from '../schema';
import type { AutomationSourceEvent } from './types';

const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-5.5';
const RAISED_BED_COLUMNS = 3;
const REVIEW_REQUESTER = 'automation:raised-bed-image-status-review';
const GREENHOUSE_SEEDLING_STATUSES = new Set([
    'pendingVerification',
    'sowed',
    'sprouted',
]);

export const RAISED_BED_IMAGE_PLANT_STATUS_REVIEW_REQUESTER = REVIEW_REQUESTER;

function hasNonBlankEnvValue(value: string | undefined) {
    return typeof value === 'string' && value.trim().length > 0;
}

const plantStatusReviewOutputSchema = z.object({
    summary: z.string(),
    proposals: z
        .array(
            z.object({
                positionLabel: z.number().int().min(1).max(18),
                requestedStatus: z.enum(imageObservablePlantFieldStatuses),
                confidence: z.number().min(0).max(1),
                evidence: z.string(),
                observedPlantCount: z.number().int().min(0).nullable(),
            }),
        )
        .max(18),
});

type RaisedBedForReview = NonNullable<Awaited<ReturnType<typeof getRaisedBed>>>;
type RaisedBedFieldForReview = RaisedBedForReview['fields'][number];
type PlantStatusReviewOutput = z.infer<typeof plantStatusReviewOutputSchema>;

type ReviewSource =
    | 'operationCompletion'
    | 'raisedBedAiAnalysis'
    | 'fieldAiAnalysis';

type ReviewInput =
    | {
          ok: true;
          source: ReviewSource;
          raisedBedId: number;
          imageUrls: string[];
          focusPositionIndex?: number;
          operationId?: number;
          raisedBedFieldId?: number | null;
          skippedInvalidImageCount: number;
      }
    | {
          ok: false;
          reason: string;
          output?: AutomationJsonObject;
      };

type ReviewProposal = PlantStatusReviewOutput['proposals'][number];

type AcceptedReviewProposal = ReviewProposal & {
    positionIndex: number;
    currentStatus: string;
    plantSortId: number;
    raisedBedFieldId: number;
};

function optionalNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isoDate(value: Date | string | null | undefined) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function daysSince(value: Date | string | null | undefined, now = Date.now()) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return Math.max(0, Math.floor((now - date.getTime()) / 86_400_000));
}

function getStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];
}

function normalizeHostedImageUrls(imageUrls: string[]) {
    let skippedInvalidImageCount = 0;
    const hostedImageUrls: string[] = [];
    const seen = new Set<string>();

    for (const imageUrl of imageUrls) {
        if (validateHostedImageUrl(imageUrl)) {
            skippedInvalidImageCount += 1;
            continue;
        }

        if (!seen.has(imageUrl)) {
            seen.add(imageUrl);
            hostedImageUrls.push(imageUrl);
        }
    }

    return { imageUrls: hostedImageUrls, skippedInvalidImageCount };
}

function imageUrlsFromData(data: AutomationJsonObject, pluralKey: string) {
    return [
        ...getStringArray(data[pluralKey]),
        ...(typeof data.imageUrl === 'string' ? [data.imageUrl] : []),
    ];
}

function parseRaisedBedFieldAggregateId(aggregateId: string) {
    const [raisedBedIdRaw, positionIndexRaw] = aggregateId.split('|');
    const raisedBedId = Number(raisedBedIdRaw);
    const positionIndex = Number(positionIndexRaw);

    if (
        !Number.isInteger(raisedBedId) ||
        raisedBedId <= 0 ||
        !Number.isInteger(positionIndex) ||
        positionIndex < 0
    ) {
        return null;
    }

    return { raisedBedId, positionIndex };
}

async function resolveReviewInput(
    event: AutomationSourceEvent,
): Promise<ReviewInput> {
    if (event.type === knownEventTypes.operations.complete) {
        const operationId = Number(event.aggregateId);
        if (!Number.isInteger(operationId) || operationId <= 0) {
            return {
                ok: false,
                reason: 'Source operation id is invalid.',
            };
        }

        let operation: Awaited<ReturnType<typeof getOperationById>>;
        try {
            operation = await getOperationById(operationId);
        } catch {
            return {
                ok: false,
                reason: 'Source operation was not found.',
                output: { operationId },
            };
        }

        if (!operation.raisedBedId) {
            return {
                ok: false,
                reason: 'Operation has no raised-bed target.',
                output: { operationId },
            };
        }

        const { imageUrls, skippedInvalidImageCount } =
            normalizeHostedImageUrls(imageUrlsFromData(event.data, 'images'));
        if (imageUrls.length === 0) {
            return {
                ok: false,
                reason: 'Operation completion has no hosted images to review.',
                output: {
                    operationId,
                    skippedInvalidImageCount,
                },
            };
        }

        return {
            ok: true,
            source: 'operationCompletion',
            raisedBedId: operation.raisedBedId,
            imageUrls,
            operationId,
            raisedBedFieldId: operation.raisedBedFieldId,
            skippedInvalidImageCount,
        };
    }

    if (event.type === knownEventTypes.raisedBeds.aiAnalysis) {
        const raisedBedId = Number(event.aggregateId);
        if (!Number.isInteger(raisedBedId) || raisedBedId <= 0) {
            return {
                ok: false,
                reason: 'Raised-bed AI analysis aggregate id is invalid.',
            };
        }

        const { imageUrls, skippedInvalidImageCount } =
            normalizeHostedImageUrls(
                imageUrlsFromData(event.data, 'imageUrls'),
            );
        if (imageUrls.length === 0) {
            return {
                ok: false,
                reason: 'Raised-bed AI analysis has no hosted images to review.',
                output: {
                    raisedBedId,
                    skippedInvalidImageCount,
                },
            };
        }

        return {
            ok: true,
            source: 'raisedBedAiAnalysis',
            raisedBedId,
            imageUrls,
            skippedInvalidImageCount,
        };
    }

    if (event.type === knownEventTypes.raisedBedFields.aiAnalysis) {
        const parsed = parseRaisedBedFieldAggregateId(event.aggregateId);
        if (!parsed) {
            return {
                ok: false,
                reason: 'Raised-bed field AI analysis aggregate id is invalid.',
            };
        }

        const { imageUrls, skippedInvalidImageCount } =
            normalizeHostedImageUrls(
                imageUrlsFromData(event.data, 'imageUrls'),
            );
        if (imageUrls.length === 0) {
            return {
                ok: false,
                reason: 'Raised-bed field AI analysis has no hosted images to review.',
                output: {
                    raisedBedId: parsed.raisedBedId,
                    positionIndex: parsed.positionIndex,
                    skippedInvalidImageCount,
                },
            };
        }

        return {
            ok: true,
            source: 'fieldAiAnalysis',
            raisedBedId: parsed.raisedBedId,
            focusPositionIndex: parsed.positionIndex,
            imageUrls,
            skippedInvalidImageCount,
        };
    }

    return {
        ok: false,
        reason: 'Source event type is not supported for image plant-status review.',
        output: { eventType: event.type },
    };
}

function isCurrentlyGreenhouseSeedling(field: RaisedBedFieldForReview) {
    return Boolean(
        field.active !== false &&
            field.sowingLocation === 'greenhouse' &&
            GREENHOUSE_SEEDLING_STATUSES.has(field.plantStatus ?? '') &&
            !field.plantDeadDate &&
            !field.plantHarvestedDate &&
            !field.plantRemovedDate,
    );
}

function getNumberAttribute(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function plantSortName(sort: EntityStandardized | undefined, fallback: string) {
    return sort?.information?.name ?? sort?.information?.label ?? fallback;
}

function plantSeedingDistance(sort: EntityStandardized | undefined) {
    return (
        getNumberAttribute(sort?.attributes?.seedingDistance) ??
        getNumberAttribute(
            sort?.information?.plant?.attributes?.seedingDistance,
        )
    );
}

function buildFieldHistory(field: RaisedBedFieldForReview) {
    return field.plantCycles.map((cycle) => ({
        positionLabel: cycle.positionIndex + 1,
        plantSortId: cycle.plantSortId ?? null,
        plantStatus: cycle.plantStatus ?? null,
        active: cycle.active,
        startedAt: isoDate(cycle.startedAt),
        endedAt: isoDate(cycle.endedAt),
        sowingLocation: cycle.sowingLocation,
        sowedAt: isoDate(cycle.plantSowDate),
        sproutedAt: isoDate(cycle.plantGrowthDate),
        readyAt: isoDate(cycle.plantReadyDate),
        deadAt: isoDate(cycle.plantDeadDate),
        harvestedAt: isoDate(cycle.plantHarvestedDate),
        removedAt: isoDate(cycle.plantRemovedDate),
    }));
}

async function buildReviewContext(input: ReviewInput & { ok: true }) {
    const raisedBed = await getRaisedBed(input.raisedBedId);
    if (!raisedBed) {
        return {
            ok: false as const,
            reason: 'Raised bed was not found.',
            output: { raisedBedId: input.raisedBedId },
        };
    }

    const plantSorts =
        await getEntitiesFormatted<EntityStandardized>('plantSort');
    const plantSortsById = new Map(
        plantSorts.map((sort) => [Number(sort.id), sort]),
    );
    const operationFocusField =
        typeof input.raisedBedFieldId === 'number'
            ? raisedBed.fields.find(
                  (field) => field.id === input.raisedBedFieldId,
              )
            : undefined;
    const focusPositionIndex =
        input.focusPositionIndex ?? operationFocusField?.positionIndex;
    const nowIso = new Date().toISOString();
    const totalFields = raisedBed.fields.length || 18;
    const rows = Math.max(1, Math.ceil(totalFields / RAISED_BED_COLUMNS));

    const fields = raisedBed.fields
        .filter((field) => field.active && field.plantSortId)
        .map((field) => {
            const plantSort = plantSortsById.get(Number(field.plantSortId));
            const seedingDistance = plantSeedingDistance(plantSort);
            const plantsPerField = calculatePlantsPerField(seedingDistance);
            const currentStatus = field.plantStatus ?? null;

            return {
                id: field.id,
                positionIndex: field.positionIndex,
                positionLabel: field.positionIndex + 1,
                plantSortId: field.plantSortId ?? null,
                plantName: plantSortName(
                    plantSort,
                    `Sorta #${field.plantSortId}`,
                ),
                currentStatus,
                currentStatusLabel: currentStatus
                    ? plantFieldStatusLabel(currentStatus).shortLabel
                    : null,
                allowedTargetStatuses:
                    getImageObservablePlantStatusTargets(currentStatus),
                sowingLocation: field.sowingLocation,
                currentLocation: isCurrentlyGreenhouseSeedling(field)
                    ? 'greenhouse'
                    : 'raisedBed',
                expectedPlantCount: plantsPerField.totalPlants,
                expectedPlantsPerRow: plantsPerField.plantsPerRow,
                seedingDistanceCm: seedingDistance,
                daysFromSowing: daysSince(field.plantSowDate),
                daysFromGrowth: daysSince(field.plantGrowthDate),
                daysFromReady: daysSince(field.plantReadyDate),
                daysFromHarvest: daysSince(field.plantHarvestedDate),
                daysFromDead: daysSince(field.plantDeadDate),
                needsRemoval: Boolean(field.toBeRemoved),
                isFocusField: field.positionIndex === focusPositionIndex,
                history: buildFieldHistory(field),
            };
        });

    return {
        ok: true as const,
        raisedBed,
        focusPositionIndex,
        promptContext: {
            currentDate: nowIso,
            source: input.source,
            operationId: input.operationId ?? null,
            imageCount: input.imageUrls.length,
            raisedBed: {
                id: raisedBed.id,
                name: raisedBed.name,
                orientation: raisedBed.orientation,
                columns: RAISED_BED_COLUMNS,
                rows,
                totalFields,
                accountId: raisedBed.accountId,
                gardenId: raisedBed.gardenId,
            },
            focusField:
                typeof focusPositionIndex === 'number'
                    ? {
                          positionIndex: focusPositionIndex,
                          positionLabel: focusPositionIndex + 1,
                      }
                    : null,
            fields,
        },
    };
}

function buildReviewMessages({
    input,
    promptContext,
}: {
    input: ReviewInput & { ok: true };
    promptContext: AutomationJsonObject;
}) {
    return [
        {
            role: 'system' as const,
            content: [
                'Ti si stručni agronom koji pregledava fotografije Gredice i predlaže ISKLJUČIVO sigurne promjene stanja biljaka.',
                'Vrati strukturirani rezultat prema shemi. Ne vraćaj markdown.',
                'Predloži promjenu samo kada je vizualni dokaz jasan i gotovo siguran; ne pogađaj na temelju kalendara, očekivanih dana rasta ili mutne/zaklonjene fotografije.',
                'Za svako polje smiješ predložiti samo status iz `allowedTargetStatuses`; ako nema odgovarajućeg statusa, preskoči polje.',
                'Ako je trenutno stanje `sowed` ili `pendingVerification`, a na slici se jasno vide klice za direktno sijanu biljku, predloži `sprouted`.',
                'Ako je fotografija close-up i polje nije sigurno prepoznatljivo, koristi `focusField` kada postoji. Ako je fotografija cijele gredice, možeš predložiti više polja.',
                'Polja s `currentLocation: "greenhouse"` ignoriraj osim ako fotografija jasno pokazuje da se ista biljka nalazi u pripadajućem polju gredice.',
                'Koristi `expectedPlantCount` kao kontekst za to koliko pojedinačnih biljaka ili klica se očekuje u polju.',
                '',
                'Raspored polja u slici cijele gredice:',
                '- Polja su numerirana od donjeg desnog kuta slike.',
                '- Donji red: 1 (donje desno), 2 (donja sredina), 3 (donje lijevo).',
                '- Kod 18-poljne gredice gornji red je 16 (gornje desno), 17 (gornja sredina), 18 (gornje lijevo).',
                '- `positionLabel` je 1-bazirana oznaka iz slike; `positionIndex = positionLabel - 1`.',
            ].join('\n'),
        },
        {
            role: 'user' as const,
            content: [
                {
                    type: 'text' as const,
                    text: [
                        'Analiziraj fotografije i kontekst. Vrati samo prijedloge promjena stanja biljaka koje su vizualno sigurne.',
                        'Ako nema sigurnih promjena, vrati prazan `proposals` niz.',
                        '',
                        'Kontekst (JSON):',
                        JSON.stringify(promptContext, null, 2),
                    ].join('\n'),
                },
                ...input.imageUrls.map((imageUrl) => ({
                    type: 'image' as const,
                    image: new URL(imageUrl),
                })),
            ],
        },
    ];
}

function proposalSkip(
    proposal: ReviewProposal,
    reason: string,
): AutomationJsonObject {
    return {
        positionLabel: proposal.positionLabel,
        requestedStatus: proposal.requestedStatus,
        confidence: proposal.confidence,
        reason,
    };
}

function filterAcceptedProposals({
    output,
    raisedBed,
    minConfidence,
}: {
    output: PlantStatusReviewOutput;
    raisedBed: RaisedBedForReview;
    minConfidence: number;
}) {
    const fieldsByPositionIndex = new Map(
        raisedBed.fields.map((field) => [field.positionIndex, field]),
    );
    const accepted: AcceptedReviewProposal[] = [];
    const skipped: AutomationJsonObject[] = [];

    for (const proposal of output.proposals) {
        const positionIndex = proposal.positionLabel - 1;
        const field = fieldsByPositionIndex.get(positionIndex);
        if (!field?.active || !field.plantSortId) {
            skipped.push(
                proposalSkip(proposal, 'Field is not actively planted.'),
            );
            continue;
        }

        const currentStatus = field.plantStatus ?? null;
        if (!currentStatus) {
            skipped.push(
                proposalSkip(proposal, 'Field has no current status.'),
            );
            continue;
        }

        if (proposal.requestedStatus === currentStatus) {
            skipped.push(
                proposalSkip(proposal, 'Field already has requested status.'),
            );
            continue;
        }

        if (proposal.confidence < minConfidence) {
            skipped.push(
                proposalSkip(
                    proposal,
                    'Proposal confidence is below threshold.',
                ),
            );
            continue;
        }

        if (
            !getImageObservablePlantStatusTargets(currentStatus).includes(
                proposal.requestedStatus,
            )
        ) {
            skipped.push(
                proposalSkip(
                    proposal,
                    'Requested status is not allowed from current status.',
                ),
            );
            continue;
        }

        accepted.push({
            ...proposal,
            positionIndex,
            currentStatus,
            plantSortId: field.plantSortId,
            raisedBedFieldId: field.id,
        });
    }

    return { accepted, skipped };
}

function buildApprovalNote({
    event,
    proposal,
    source,
}: {
    event: AutomationSourceEvent;
    proposal: AcceptedReviewProposal;
    source: ReviewSource;
}) {
    const requestedStatusLabel = plantFieldStatusLabel(
        proposal.requestedStatus,
    ).shortLabel;
    const currentStatusLabel = plantFieldStatusLabel(
        proposal.currentStatus,
    ).shortLabel;

    return [
        'AI analiza fotografija gredice predlaže promjenu stanja biljke.',
        `Izvor: ${source}.`,
        event.id ? `Event ID: ${event.id}.` : null,
        `Polje: ${proposal.positionLabel}.`,
        `Promjena: ${currentStatusLabel} -> ${requestedStatusLabel}.`,
        `Pouzdanost: ${Math.round(proposal.confidence * 100)}%.`,
        proposal.observedPlantCount !== null
            ? `Uočeni broj biljaka/klica: ${proposal.observedPlantCount}.`
            : null,
        `Dokaz: ${proposal.evidence}`,
    ]
        .filter((line): line is string => typeof line === 'string')
        .join('\n');
}

export function hasRaisedBedImagePlantStatusReviewAiConfig() {
    return (
        hasNonBlankEnvValue(process.env.AI_GATEWAY_API_KEY) ||
        hasNonBlankEnvValue(process.env.VERCEL_OIDC_TOKEN)
    );
}

export async function runRaisedBedImagePlantStatusReview({
    event,
    minConfidence,
    requestedBy = REVIEW_REQUESTER,
}: {
    event: AutomationSourceEvent;
    minConfidence: number;
    requestedBy?: string;
}) {
    const input = await resolveReviewInput(event);
    if (!input.ok) {
        return {
            ok: false as const,
            reason: input.reason,
            output: input.output ?? {},
        };
    }

    const context = await buildReviewContext(input);
    if (!context.ok) {
        return {
            ok: false as const,
            reason: context.reason,
            output: context.output,
        };
    }

    const messages = buildReviewMessages({
        input,
        promptContext: context.promptContext,
    });
    const result = await generateText({
        model: AI_MODEL,
        output: Output.object({
            name: 'RaisedBedImagePlantStatusReview',
            description:
                'High-certainty plant status change proposals from raised-bed images.',
            schema: plantStatusReviewOutputSchema,
        }),
        messages,
    });
    const output = result.output;
    const { accepted, skipped } = filterAcceptedProposals({
        output,
        raisedBed: context.raisedBed,
        minConfidence,
    });

    const requestIds: string[] = [];
    const requestErrors: AutomationJsonObject[] = [];
    for (const proposal of accepted) {
        try {
            const request = await createPlantStatusApprovalRequest({
                raisedBedId: input.raisedBedId,
                positionIndex: proposal.positionIndex,
                requestedStatus: proposal.requestedStatus,
                requestedBy,
                raisedBedFieldId: proposal.raisedBedFieldId,
                accountId: context.raisedBed.accountId,
                gardenId: context.raisedBed.gardenId,
                plantSortId: proposal.plantSortId,
                currentStatus: proposal.currentStatus,
                effectiveAt: event.createdAt,
                note: buildApprovalNote({
                    event,
                    proposal,
                    source: input.source,
                }),
            });
            requestIds.push(request.id);
        } catch (error) {
            requestErrors.push({
                positionLabel: proposal.positionLabel,
                requestedStatus: proposal.requestedStatus,
                reason:
                    error instanceof Error
                        ? error.message
                        : 'Failed to create approval request.',
            });
        }
    }

    return {
        ok: true as const,
        output: {
            source: input.source,
            raisedBedId: input.raisedBedId,
            operationId: input.operationId ?? null,
            focusPositionIndex: context.focusPositionIndex ?? null,
            imageCount: input.imageUrls.length,
            skippedInvalidImageCount: input.skippedInvalidImageCount,
            model: AI_MODEL,
            summary: output.summary,
            proposalCount: output.proposals.length,
            acceptedProposalCount: accepted.length,
            requestIds,
            requestCount: requestIds.length,
            skippedProposals: skipped,
            requestErrors,
            inputTokens: optionalNumber(result.usage.inputTokens),
            outputTokens: optionalNumber(result.usage.outputTokens),
            totalTokens: optionalNumber(result.usage.totalTokens),
            analyzedAt: new Date().toISOString(),
        } satisfies AutomationJsonObject,
    };
}

export async function previewRaisedBedImagePlantStatusReview(
    event: AutomationSourceEvent,
) {
    const input = await resolveReviewInput(event);
    if (!input.ok) {
        return {
            ok: false as const,
            reason: input.reason,
            output: input.output ?? {},
        };
    }

    const context = await buildReviewContext(input);
    if (!context.ok) {
        return {
            ok: false as const,
            reason: context.reason,
            output: context.output,
        };
    }

    return {
        ok: true as const,
        output: {
            source: input.source,
            raisedBedId: input.raisedBedId,
            operationId: input.operationId ?? null,
            focusPositionIndex: context.focusPositionIndex ?? null,
            imageCount: input.imageUrls.length,
            skippedInvalidImageCount: input.skippedInvalidImageCount,
            plantedFieldCount: Array.isArray(context.promptContext.fields)
                ? context.promptContext.fields.length
                : 0,
        } satisfies AutomationJsonObject,
    };
}
