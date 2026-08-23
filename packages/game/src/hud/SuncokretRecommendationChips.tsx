'use client';

import { Chip } from '@gredice/ui/Chip';
import { Sprout } from '@gredice/ui/icons';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useOperations } from '../hooks/useOperations';
import { useAllSorts } from '../hooks/usePlantSorts';
import { isRaisedBedFieldOccupied } from '../utils/raisedBedFields';
import { RaisedBedAiOperationChip } from './raisedBed/RaisedBedAiOperationMarkdown';
import { PlantPicker } from './raisedBed/RaisedBedPlantPicker';
import { resolveOperationRecommendationTargets } from './suncokretOperationRecommendationTargets';

type OperationRecommendation = {
    kind: 'operation';
    operationId: number;
    gardenId: number;
    raisedBedId: number;
    positionIndex?: number;
    scheduledDate?: string;
};

type SowingRecommendation = {
    kind: 'sowing';
    plantSortId: number;
    gardenId: number;
    raisedBedId: number;
    positionIndex: number;
    scheduledDate?: string;
};

export type SuncokretRecommendation =
    | OperationRecommendation
    | SowingRecommendation;

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function positiveInteger(value: unknown) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
        ? value
        : null;
}

function nonNegativeInteger(value: unknown) {
    return typeof value === 'number' &&
        Number.isSafeInteger(value) &&
        value >= 0
        ? value
        : null;
}

function calendarDate(value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return undefined;
    }

    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
        ? value
        : undefined;
}

function parseRecommendation(value: unknown): SuncokretRecommendation | null {
    if (!isRecord(value)) {
        return null;
    }

    const gardenId = positiveInteger(value.gardenId);
    const raisedBedId = positiveInteger(value.raisedBedId);
    if (!gardenId || !raisedBedId) {
        return null;
    }

    const scheduledDate = calendarDate(value.scheduledDate);
    if (value.kind === 'operation') {
        const operationId = positiveInteger(value.operationId);
        const positionIndex =
            value.positionIndex === undefined
                ? undefined
                : nonNegativeInteger(value.positionIndex);
        if (!operationId || positionIndex === null) {
            return null;
        }

        return {
            kind: 'operation',
            operationId,
            gardenId,
            raisedBedId,
            ...(typeof positionIndex === 'number' ? { positionIndex } : {}),
            ...(scheduledDate ? { scheduledDate } : {}),
        };
    }

    if (value.kind === 'sowing') {
        const plantSortId = positiveInteger(value.plantSortId);
        const positionIndex = nonNegativeInteger(value.positionIndex);
        if (!plantSortId || positionIndex === null) {
            return null;
        }

        return {
            kind: 'sowing',
            plantSortId,
            gardenId,
            raisedBedId,
            positionIndex,
            ...(scheduledDate ? { scheduledDate } : {}),
        };
    }

    return null;
}

export function parseSuncokretRecommendations(value: unknown) {
    if (!isRecord(value) || !Array.isArray(value.recommendations)) {
        return [];
    }

    return value.recommendations
        .map(parseRecommendation)
        .filter(
            (recommendation): recommendation is SuncokretRecommendation =>
                recommendation !== null,
        )
        .slice(0, 6);
}

function DisabledSowingChip({
    label,
    title,
}: {
    label: string;
    title: string;
}) {
    return (
        <Chip
            color="warning"
            data-suncokret-sowing-chip
            disabled
            size="sm"
            startDecorator={<Sprout />}
            title={title}
            variant="outlined"
        >
            {label}
        </Chip>
    );
}

function parseScheduledDate(value: string | undefined) {
    if (!value) {
        return undefined;
    }

    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function SowingRecommendationChip({
    recommendation,
}: {
    recommendation: SowingRecommendation;
}) {
    const { data: garden } = useCurrentGarden();
    const { data: plantSorts } = useAllSorts();
    const plantSort = plantSorts?.find(
        (candidate) => candidate.id === recommendation.plantSortId,
    );
    const raisedBed = garden?.raisedBeds.find(
        (candidate) => candidate.id === recommendation.raisedBedId,
    );
    const field = raisedBed?.fields.find(
        (candidate) => candidate.positionIndex === recommendation.positionIndex,
    );
    const fallbackLabel = `Sijanje - polje ${(
        recommendation.positionIndex + 1
    ).toString()}`;
    const label = plantSort
        ? `${plantSort.information.name} - polje ${(
              recommendation.positionIndex + 1
          ).toString()}`
        : fallbackLabel;

    const disabledReason = !plantSort
        ? 'Predložena sorta više nije dostupna u katalogu.'
        : garden?.id !== recommendation.gardenId
          ? 'Otvori vrt iz ovog razgovora kako bi odabrao sijanje.'
          : raisedBed?.status !== 'active'
            ? 'Ciljna gredica nije aktivna ili više nije dostupna.'
            : isRaisedBedFieldOccupied(field)
              ? 'Na ciljnom polju već se nalazi biljka.'
              : null;

    if (!plantSort || !raisedBed || disabledReason) {
        return (
            <DisabledSowingChip label={label} title={disabledReason ?? ''} />
        );
    }

    return (
        <PlantPicker
            gardenId={recommendation.gardenId}
            positionIndex={recommendation.positionIndex}
            raisedBedId={recommendation.raisedBedId}
            selectedPlantId={plantSort.information.plant.id}
            selectedPlantOptions={{
                scheduledDate: parseScheduledDate(recommendation.scheduledDate),
            }}
            selectedSortId={plantSort.id}
            trigger={
                <Chip
                    color="success"
                    data-suncokret-sowing-chip
                    size="sm"
                    startDecorator={<Sprout />}
                    title={`Otvori sijanje: ${label}`}
                    variant="soft"
                >
                    {label}
                </Chip>
            }
        />
    );
}

export function SuncokretRecommendationChips({ output }: { output: unknown }) {
    const recommendations = parseSuncokretRecommendations(output);
    const { data: garden } = useCurrentGarden();
    const { data: operations } = useOperations();
    const { data: plantSorts } = useAllSorts();
    if (recommendations.length === 0) {
        return null;
    }

    const resolvedRecommendations = recommendations
        .flatMap<SuncokretRecommendation>(
            (recommendation): SuncokretRecommendation[] => {
                if (recommendation.kind !== 'operation') {
                    return [recommendation];
                }

                return resolveOperationRecommendationTargets({
                    garden,
                    operation: operations?.find(
                        (operation) =>
                            operation.id === recommendation.operationId,
                    ),
                    plantSorts,
                    recommendation,
                });
            },
        )
        .slice(0, 6);

    return (
        <fieldset
            className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0"
            data-suncokret-recommendations
        >
            <legend className="sr-only">Preporučene radnje i sijanja</legend>
            {resolvedRecommendations.map((recommendation) => {
                const entityId =
                    recommendation.kind === 'operation'
                        ? recommendation.operationId
                        : recommendation.plantSortId;
                const key = [
                    recommendation.kind,
                    entityId,
                    recommendation.gardenId,
                    recommendation.raisedBedId,
                    recommendation.positionIndex ?? 'bed',
                ].join(':');

                return (
                    <span
                        data-suncokret-recommendation={recommendation.kind}
                        key={key}
                    >
                        {recommendation.kind === 'operation' ? (
                            <RaisedBedAiOperationChip
                                gardenId={recommendation.gardenId}
                                label=""
                                target={{
                                    operationId: recommendation.operationId,
                                    raisedBedId: recommendation.raisedBedId,
                                    positionIndex: recommendation.positionIndex,
                                    scheduledDate: recommendation.scheduledDate,
                                }}
                            />
                        ) : (
                            <SowingRecommendationChip
                                recommendation={recommendation}
                            />
                        )}
                    </span>
                );
            })}
        </fieldset>
    );
}
