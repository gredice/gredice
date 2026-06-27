import { sanitizeRaisedBedAiMarkdown } from '@gredice/js/ai';
import {
    calculatePlantsPerField,
    getImageObservablePlantStatusTargets,
    imageObservablePlantFieldStatuses,
    plantFieldStatusLabel,
} from '@gredice/js/plants';
import { validateHostedImageUrl } from '@gredice/js/urls';
import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { z } from 'zod';
import type { EntityStandardized } from '../@types/EntityStandardized';
import { createPlantStatusApprovalRequest } from '../repositories/approvalRequestsRepo';
import { getEntitiesFormatted } from '../repositories/entitiesRepo';
import {
    knownEventTypes,
    type RaisedBedWeedStateLevel,
} from '../repositories/events';
import {
    getRaisedBed,
    setRaisedBedFieldWeedState,
} from '../repositories/gardensRepo';
import { getOperationById } from '../repositories/operationsRepo';
import type { AutomationJsonObject } from '../schema';
import { buildPreviousPlantNames } from './raisedBedImagePlantContext';
import type { AutomationSourceEvent } from './types';

const AI_MODEL = process.env.AI_GATEWAY_MODEL ?? 'openai/gpt-5.5';
const RAISED_BED_COLUMNS = 3;
const REVIEW_REQUESTER = 'automation:raised-bed-image-status-review';
const MAX_AI_DEBUG_TEXT_LENGTH = 8_000;
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
    weedProposals: z
        .array(
            z.object({
                positionLabel: z.number().int().min(1).max(18),
                requestedWeedLevel: z.enum(['none', 'light', 'heavy']),
                confidence: z.number().min(0).max(1),
                evidence: z.string(),
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
          referenceDate: Date;
          skippedInvalidImageCount: number;
      }
    | {
          ok: false;
          reason: string;
          output?: AutomationJsonObject;
      };

type ReviewProposal = PlantStatusReviewOutput['proposals'][number];
type WeedReviewProposal = PlantStatusReviewOutput['weedProposals'][number];

type AcceptedReviewProposal = ReviewProposal & {
    positionIndex: number;
    currentStatus: string;
    plantSortId: number;
    raisedBedFieldId: number;
};

type AcceptedWeedReviewProposal = WeedReviewProposal & {
    positionIndex: number;
    currentWeedLevel: RaisedBedWeedStateLevel | null;
    raisedBedFieldId: number;
};

function optionalNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function truncateDebugText(value: string | undefined) {
    if (typeof value !== 'string') {
        return {
            text: null,
            length: null,
            truncated: false,
        };
    }

    return {
        text:
            value.length > MAX_AI_DEBUG_TEXT_LENGTH
                ? value.slice(0, MAX_AI_DEBUG_TEXT_LENGTH)
                : value,
        length: value.length,
        truncated: value.length > MAX_AI_DEBUG_TEXT_LENGTH,
    };
}

function errorCauseDetails(cause: unknown) {
    if (cause instanceof Error) {
        return {
            name: cause.name,
            message: cause.message,
        };
    }

    return {
        name: null,
        message: typeof cause === 'string' ? cause : null,
    };
}

function dateFromValue(value: unknown) {
    if (!(value instanceof Date) && typeof value !== 'string') {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function getReviewReferenceDate(event: AutomationSourceEvent) {
    return (
        dateFromValue(event.data.referenceDate) ?? event.createdAt ?? new Date()
    );
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
    const referenceDate = getReviewReferenceDate(event);

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
            referenceDate,
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
            referenceDate,
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
            referenceDate,
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

function weedStateContext(weedState: RaisedBedForReview['weedState']) {
    return weedState
        ? {
              level: weedState.level,
              source: weedState.source,
              observedAt: weedState.observedAt.toISOString(),
              updatedAt: weedState.updatedAt.toISOString(),
              notes: weedState.notes ?? null,
          }
        : null;
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
    const imageDateIso = input.referenceDate.toISOString();
    const totalFields = raisedBed.fields.length || 18;
    const rows = Math.max(1, Math.ceil(totalFields / RAISED_BED_COLUMNS));

    const fields = raisedBed.fields
        .filter((field) => field.active)
        .map((field) => {
            const plantSort =
                typeof field.plantSortId === 'number'
                    ? plantSortsById.get(field.plantSortId)
                    : undefined;
            const seedingDistance = plantSeedingDistance(plantSort);
            const plantsPerField = field.plantSortId
                ? calculatePlantsPerField(seedingDistance)
                : null;
            const currentStatus = field.plantStatus ?? null;
            const previousPlantNames = buildPreviousPlantNames(
                field,
                plantSortsById,
            );

            return {
                id: field.id,
                positionIndex: field.positionIndex,
                positionLabel: field.positionIndex + 1,
                plantSortId: field.plantSortId ?? null,
                plantName: field.plantSortId
                    ? plantSortName(plantSort, `Sorta #${field.plantSortId}`)
                    : null,
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
                expectedPlantCount: plantsPerField?.totalPlants ?? null,
                expectedPlantsPerRow: plantsPerField?.plantsPerRow ?? null,
                seedingDistanceCm: seedingDistance,
                currentFieldWeedState: weedStateContext(field.weedState),
                currentFieldWeedLevel: field.weedState?.level ?? null,
                daysFromSowing: daysSince(
                    field.plantSowDate,
                    input.referenceDate.getTime(),
                ),
                daysFromGrowth: daysSince(
                    field.plantGrowthDate,
                    input.referenceDate.getTime(),
                ),
                daysFromReady: daysSince(
                    field.plantReadyDate,
                    input.referenceDate.getTime(),
                ),
                daysFromHarvest: daysSince(
                    field.plantHarvestedDate,
                    input.referenceDate.getTime(),
                ),
                daysFromDead: daysSince(
                    field.plantDeadDate,
                    input.referenceDate.getTime(),
                ),
                needsRemoval: Boolean(field.toBeRemoved),
                isFocusField: field.positionIndex === focusPositionIndex,
                ...(previousPlantNames.length > 0
                    ? { previousPlantNames }
                    : {}),
            };
        });

    return {
        ok: true as const,
        raisedBed,
        focusPositionIndex,
        promptContext: {
            currentDate: nowIso,
            imageDate: imageDateIso,
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
                currentWeedState: weedStateContext(raisedBed.weedState),
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
                'U poljima `summary` i `evidence` piši normalne hrvatske rečenice. Ne spominji interne nazive ili JSON ključeve kao `positionIndex`, `needsRemoval`, `plantStatus`, `plantSortId`, `currentLocation` ili `sowingLocation`.',
                'Predloži promjenu samo kada je vizualni dokaz jasan i gotovo siguran; ne pogađaj na temelju kalendara, očekivanih dana rasta ili mutne/zaklonjene fotografije.',
                'Za svako polje smiješ predložiti plant-status samo iz `allowedTargetStatuses`; ako nema odgovarajućeg statusa, preskoči plant-status prijedlog za to polje.',
                'Ako je trenutno stanje `sowed` ili `pendingVerification`, a na slici se jasno vide klice za direktno sijanu biljku, predloži `sprouted`.',
                'U `weedProposals` predloži field-level status korova (`none`, `light` ili `heavy`) samo kada se korovi ili očišćeno polje jasno vide za pojedino polje.',
                'Ne predlaži `none` za korove samo zato što korovi nisu vidljivi; predloži `none` samo kada slika jasno pokazuje da je polje čisto, osobito ako postoji trenutačni field ili raised-bed weed state.',
                '`raisedBed.currentWeedState` je stanje na razini cijele gredice. `field.currentFieldWeedState` i `field.currentFieldWeedLevel` su stanje za pojedino polje; field-level prijedlozi smiju precizirati ili očistiti stanje iz gredice.',
                'Ako je fotografija close-up i polje nije sigurno prepoznatljivo, koristi `focusField` kada postoji. Ako je fotografija cijele gredice, možeš predložiti više polja.',
                'Polja s `currentLocation: "greenhouse"` ignoriraj osim ako fotografija jasno pokazuje da se ista biljka nalazi u pripadajućem polju gredice.',
                'Koristi `expectedPlantCount` kao kontekst za to koliko pojedinačnih biljaka ili klica se očekuje u polju.',
                '`previousPlantNames` sadrži samo nazive ranijih biljaka u tom polju; ne sadrži povijest događaja, statuse ni datume.',
                '`imageDate` je datum fotografija ili izvornog dnevničkog unosa; koristi ga za kontekst polja i vrijednosti `daysFrom*`. `currentDate` je trenutak obrade automatizacije i ne smije promijeniti interpretaciju stanja na starijoj fotografiji.',
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
                        'Vrati i prijedloge statusa korova za pojedinačna polja kada su vizualno sigurni.',
                        'Ako nema sigurnih promjena, vrati prazne `proposals` i `weedProposals` nizove.',
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

function weedProposalSkip(
    proposal: WeedReviewProposal,
    reason: string,
): AutomationJsonObject {
    return {
        positionLabel: proposal.positionLabel,
        requestedWeedLevel: proposal.requestedWeedLevel,
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

function filterAcceptedWeedProposals({
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
    const raisedBedHasVisibleWeeds =
        raisedBed.weedState?.level === 'light' ||
        raisedBed.weedState?.level === 'heavy';
    const accepted: AcceptedWeedReviewProposal[] = [];
    const skipped: AutomationJsonObject[] = [];

    for (const proposal of output.weedProposals) {
        const positionIndex = proposal.positionLabel - 1;
        const field = fieldsByPositionIndex.get(positionIndex);
        if (!field?.active) {
            skipped.push(weedProposalSkip(proposal, 'Field is not active.'));
            continue;
        }

        const currentWeedLevel = field.weedState?.level ?? null;
        if (proposal.requestedWeedLevel === currentWeedLevel) {
            skipped.push(
                weedProposalSkip(
                    proposal,
                    'Field already has requested weed level.',
                ),
            );
            continue;
        }

        if (
            proposal.requestedWeedLevel === 'none' &&
            currentWeedLevel === null &&
            !raisedBedHasVisibleWeeds
        ) {
            skipped.push(
                weedProposalSkip(
                    proposal,
                    'Field has no stored weed state to clear.',
                ),
            );
            continue;
        }

        if (proposal.confidence < minConfidence) {
            skipped.push(
                weedProposalSkip(
                    proposal,
                    'Proposal confidence is below threshold.',
                ),
            );
            continue;
        }

        accepted.push({
            ...proposal,
            positionIndex,
            currentWeedLevel,
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
        `Dokaz: ${sanitizeRaisedBedAiMarkdown(proposal.evidence)}`,
    ]
        .filter((line): line is string => typeof line === 'string')
        .join('\n');
}

function buildWeedStateNotes({
    event,
    proposal,
    source,
}: {
    event: AutomationSourceEvent;
    proposal: AcceptedWeedReviewProposal;
    source: ReviewSource;
}) {
    return [
        'AI analiza fotografija gredice predlaže status korova za polje.',
        `Izvor: ${source}.`,
        event.id ? `Event ID: ${event.id}.` : null,
        `Polje: ${proposal.positionLabel}.`,
        `Promjena: ${proposal.currentWeedLevel ?? 'none'} -> ${proposal.requestedWeedLevel}.`,
        `Pouzdanost: ${Math.round(proposal.confidence * 100)}%.`,
        `Dokaz: ${sanitizeRaisedBedAiMarkdown(proposal.evidence)}`,
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

function buildNoObjectGeneratedDebugOutput({
    error,
    input,
    focusPositionIndex,
}: {
    error: NoObjectGeneratedError;
    input: ReviewInput & { ok: true };
    focusPositionIndex: number | undefined;
}) {
    const rawResponse = truncateDebugText(error.text);
    const cause = errorCauseDetails(error.cause);

    return {
        source: input.source,
        raisedBedId: input.raisedBedId,
        operationId: input.operationId ?? null,
        raisedBedFieldId: input.raisedBedFieldId ?? null,
        focusPositionIndex: focusPositionIndex ?? null,
        imageDate: input.referenceDate.toISOString(),
        imageCount: input.imageUrls.length,
        skippedInvalidImageCount: input.skippedInvalidImageCount,
        model: AI_MODEL,
        aiResponseDebug: {
            type: 'NoObjectGeneratedError',
            message: error.message,
            causeName: cause.name,
            causeMessage: cause.message,
            finishReason: error.finishReason ?? null,
            responseId: error.response?.id ?? null,
            responseModel: error.response?.modelId ?? null,
            responseTimestamp:
                error.response?.timestamp instanceof Date
                    ? error.response.timestamp.toISOString()
                    : null,
            rawResponseText: rawResponse.text,
            rawResponseLength: rawResponse.length,
            rawResponseTruncated: rawResponse.truncated,
        },
        inputTokens: optionalNumber(error.usage?.inputTokens),
        outputTokens: optionalNumber(error.usage?.outputTokens),
        totalTokens: optionalNumber(error.usage?.totalTokens),
        analyzedAt: new Date().toISOString(),
    } satisfies AutomationJsonObject;
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
    const aiResult = await (async () => {
        try {
            return {
                ok: true as const,
                result: await generateText({
                    model: AI_MODEL,
                    output: Output.object({
                        name: 'RaisedBedImagePlantStatusReview',
                        description:
                            'High-certainty plant status change proposals from raised-bed images.',
                        schema: plantStatusReviewOutputSchema,
                    }),
                    messages,
                }),
            };
        } catch (error) {
            if (NoObjectGeneratedError.isInstance(error)) {
                const output = buildNoObjectGeneratedDebugOutput({
                    error,
                    input,
                    focusPositionIndex: context.focusPositionIndex,
                });
                const rawResponse = truncateDebugText(error.text);
                const cause = errorCauseDetails(error.cause);

                console.warn(
                    'Raised-bed image plant-status review AI response could not be parsed.',
                    {
                        source: input.source,
                        raisedBedId: input.raisedBedId,
                        operationId: input.operationId ?? null,
                        imageDate: input.referenceDate.toISOString(),
                        model: AI_MODEL,
                        message: error.message,
                        causeName: cause.name,
                        causeMessage: cause.message,
                        finishReason: error.finishReason ?? null,
                        responseId: error.response?.id ?? null,
                        rawResponseLength: rawResponse.length,
                        rawResponseTruncated: rawResponse.truncated,
                        rawResponsePreview:
                            typeof rawResponse.text === 'string'
                                ? rawResponse.text.slice(0, 1_000)
                                : null,
                    },
                );

                return {
                    ok: false as const,
                    reason: error.message,
                    retryable: true,
                    errorCode:
                        'raised_bed_image_plant_status_review_no_object_generated',
                    output,
                };
            }

            throw error;
        }
    })();

    if (!aiResult.ok) {
        return aiResult;
    }

    const result = aiResult.result;
    const output = result.output;
    const { accepted, skipped } = filterAcceptedProposals({
        output,
        raisedBed: context.raisedBed,
        minConfidence,
    });
    const { accepted: acceptedWeeds, skipped: skippedWeeds } =
        filterAcceptedWeedProposals({
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
                effectiveAt: input.referenceDate,
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

    const weedStateEventIds: number[] = [];
    const weedStateErrors: AutomationJsonObject[] = [];
    for (const proposal of acceptedWeeds) {
        try {
            const weedStateEvent = await setRaisedBedFieldWeedState({
                level: proposal.requestedWeedLevel,
                notes: buildWeedStateNotes({
                    event,
                    proposal,
                    source: input.source,
                }),
                observedAt: input.referenceDate,
                positionIndex: proposal.positionIndex,
                raisedBedId: input.raisedBedId,
                source: 'ai',
            });
            weedStateEventIds.push(weedStateEvent.id);
        } catch (error) {
            weedStateErrors.push({
                positionLabel: proposal.positionLabel,
                requestedWeedLevel: proposal.requestedWeedLevel,
                reason:
                    error instanceof Error
                        ? error.message
                        : 'Failed to create weed-state event.',
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
            imageDate: input.referenceDate.toISOString(),
            imageCount: input.imageUrls.length,
            skippedInvalidImageCount: input.skippedInvalidImageCount,
            model: AI_MODEL,
            summary: sanitizeRaisedBedAiMarkdown(output.summary),
            proposalCount: output.proposals.length,
            acceptedProposalCount: accepted.length,
            requestIds,
            requestCount: requestIds.length,
            skippedProposals: skipped,
            requestErrors,
            weedProposalCount: output.weedProposals.length,
            acceptedWeedProposalCount: acceptedWeeds.length,
            weedStateEventIds,
            weedStateEventCount: weedStateEventIds.length,
            skippedWeedProposals: skippedWeeds,
            weedStateErrors,
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
            imageDate: input.referenceDate.toISOString(),
            imageCount: input.imageUrls.length,
            skippedInvalidImageCount: input.skippedInvalidImageCount,
            plantedFieldCount: Array.isArray(context.promptContext.fields)
                ? context.promptContext.fields.filter(
                      (field) =>
                          field &&
                          typeof field === 'object' &&
                          'plantSortId' in field &&
                          field.plantSortId !== null,
                  ).length
                : 0,
            trackedFieldCount: Array.isArray(context.promptContext.fields)
                ? context.promptContext.fields.length
                : 0,
            fieldWeedStateCount: Array.isArray(context.promptContext.fields)
                ? context.promptContext.fields.filter(
                      (field) =>
                          field &&
                          typeof field === 'object' &&
                          'currentFieldWeedState' in field &&
                          field.currentFieldWeedState !== null,
                  ).length
                : 0,
            raisedBedWeedState:
                context.promptContext.raisedBed &&
                typeof context.promptContext.raisedBed === 'object' &&
                'currentWeedState' in context.promptContext.raisedBed
                    ? context.promptContext.raisedBed.currentWeedState
                    : null,
        } satisfies AutomationJsonObject,
    };
}
