import {
    getEventAggregateIdsByAggregateIdPrefix,
    getLatestEvents,
    getLatestEventsByAggregateIdPrefix,
    getRaisedBed,
    knownEventTypes,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { ButtonGroup, buttonGroupItemClassName } from '@gredice/ui/ButtonGroup';
import { CardContent, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { ArrowLeft, ArrowRight, Fence, Hash, Sprout } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import { updateRaisedBedEventDateAction } from '../../app/(actions)/raisedBedEventsActions';
import { KnownPages } from '../../src/KnownPages';
import { EventDateEditButton } from '../shared/events/EventDateEditButton';
import { EventsTable } from '../shared/events/EventsTable';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { RaisedBedEventDeleteButton } from './RaisedBedEventDeleteButton';

type RaisedBedEventsSearchParams = Record<
    string,
    string | string[] | undefined
>;

interface RaisedBedEventsTableProps {
    raisedBedId: number;
    searchParams?: RaisedBedEventsSearchParams | undefined;
}

type RaisedBedEventsScope = 'raisedBed' | 'plants';

const RAISED_BED_EVENTS_SECTION_ID = 'raised-bed-events';
const RAISED_BED_EVENTS_SCOPE_PARAM = 'eventsScope';
const RAISED_BED_EVENTS_FIELD_PARAM = 'eventsField';
const RAISED_BED_EVENTS_PAGE_PARAM = 'eventsPage';
const RAISED_BED_EVENTS_PAGE_SIZE = 25;
const DEFAULT_RAISED_BED_EVENTS_SCOPE: RaisedBedEventsScope = 'plants';

const RAISED_BED_EVENT_TYPES = [
    knownEventTypes.raisedBeds.create,
    knownEventTypes.raisedBeds.place,
    knownEventTypes.raisedBeds.delete,
    knownEventTypes.raisedBeds.abandon,
    knownEventTypes.raisedBeds.aiAnalysis,
];

const PLANT_EVENT_TYPES = [
    knownEventTypes.raisedBedFields.create,
    knownEventTypes.raisedBedFields.delete,
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantSchedule,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedFields.plantReplaceSort,
    knownEventTypes.raisedBedFields.aiAnalysis,
];

const EVENT_TYPE_LABELS: Record<string, string> = {
    [knownEventTypes.raisedBeds.create]: 'Gredica stvorena',
    [knownEventTypes.raisedBeds.place]: 'Gredica postavljena',
    [knownEventTypes.raisedBeds.delete]: 'Gredica obrisana',
    [knownEventTypes.raisedBeds.abandon]: 'Gredica napuštena',
    [knownEventTypes.raisedBeds.aiAnalysis]: 'Analiza gredice',
    [knownEventTypes.raisedBedFields.create]: 'Polje stvoreno',
    [knownEventTypes.raisedBedFields.delete]: 'Polje obrisano',
    [knownEventTypes.raisedBedFields.plantPlace]: 'Biljka postavljena',
    [knownEventTypes.raisedBedFields.plantSchedule]: 'Biljka planirana',
    [knownEventTypes.raisedBedFields.plantUpdate]: 'Biljka ažurirana',
    [knownEventTypes.raisedBedFields.plantReplaceSort]: 'Biljka promijenjena',
    [knownEventTypes.raisedBedFields.aiAnalysis]: 'Analiza biljke',
};

type StorageEvent = Awaited<ReturnType<typeof getLatestEvents>>[number];

function searchParamValue(
    searchParams: RaisedBedEventsSearchParams | undefined,
    key: string,
) {
    const value = searchParams?.[key];
    return typeof value === 'string' ? value : undefined;
}

function raisedBedEventsScope(
    searchParams?: RaisedBedEventsSearchParams,
): RaisedBedEventsScope {
    return searchParamValue(searchParams, RAISED_BED_EVENTS_SCOPE_PARAM) ===
        'raisedBed'
        ? 'raisedBed'
        : DEFAULT_RAISED_BED_EVENTS_SCOPE;
}

function raisedBedEventsPage(searchParams?: RaisedBedEventsSearchParams) {
    const pageValue = searchParamValue(
        searchParams,
        RAISED_BED_EVENTS_PAGE_PARAM,
    );
    const pageNumber = pageValue ? Number(pageValue) : 1;

    return Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
}

function copySearchParams(searchParams?: RaisedBedEventsSearchParams) {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(searchParams ?? {})) {
        if (Array.isArray(value)) {
            for (const item of value) {
                params.append(key, item);
            }
            continue;
        }

        if (typeof value === 'string') {
            params.set(key, value);
        }
    }

    return params;
}

function buildRaisedBedEventsHref({
    fieldPositionIndex,
    page,
    raisedBedId,
    scope,
    searchParams,
}: {
    fieldPositionIndex?: number | undefined;
    page: number;
    raisedBedId: number;
    scope: RaisedBedEventsScope;
    searchParams?: RaisedBedEventsSearchParams | undefined;
}) {
    const params = copySearchParams(searchParams);

    if (scope === DEFAULT_RAISED_BED_EVENTS_SCOPE) {
        params.delete(RAISED_BED_EVENTS_SCOPE_PARAM);
    } else {
        params.set(RAISED_BED_EVENTS_SCOPE_PARAM, scope);
    }

    if (scope === 'plants' && typeof fieldPositionIndex === 'number') {
        params.set(
            RAISED_BED_EVENTS_FIELD_PARAM,
            fieldPositionIndex.toString(),
        );
    } else {
        params.delete(RAISED_BED_EVENTS_FIELD_PARAM);
    }

    if (page > 1) {
        params.set(RAISED_BED_EVENTS_PAGE_PARAM, page.toString());
    } else {
        params.delete(RAISED_BED_EVENTS_PAGE_PARAM);
    }

    const query = params.toString();
    return `${KnownPages.RaisedBed(raisedBedId)}${query ? `?${query}` : ''}#${RAISED_BED_EVENTS_SECTION_ID}`;
}

function fieldAggregateId(raisedBedId: number, positionIndex: number) {
    return `${raisedBedId.toString()}|${positionIndex.toString()}`;
}

function fieldPositionIndexFromAggregateId(
    aggregateId: string,
    raisedBedId: number,
) {
    const prefix = `${raisedBedId.toString()}|`;
    if (!aggregateId.startsWith(prefix)) {
        return null;
    }

    const positionIndexRaw = aggregateId.slice(prefix.length);
    if (!/^\d+$/.test(positionIndexRaw)) {
        return null;
    }

    const positionIndex = Number.parseInt(positionIndexRaw, 10);
    return Number.isSafeInteger(positionIndex) ? positionIndex : null;
}

function selectedFieldPositionIndex({
    availablePositionIndices,
    searchParams,
    scope,
}: {
    availablePositionIndices: number[];
    searchParams?: RaisedBedEventsSearchParams | undefined;
    scope: RaisedBedEventsScope;
}) {
    if (scope !== 'plants') {
        return undefined;
    }

    const fieldValue = searchParamValue(
        searchParams,
        RAISED_BED_EVENTS_FIELD_PARAM,
    );
    if (!fieldValue || !/^\d+$/.test(fieldValue)) {
        return undefined;
    }

    const positionIndex = Number.parseInt(fieldValue, 10);
    return availablePositionIndices.includes(positionIndex)
        ? positionIndex
        : undefined;
}

function parseDateValue(value: unknown): Date | null {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'string' && value.length) {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    return null;
}

function eventDataRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }

    return value as Record<string, unknown>;
}

function renderEventDetails(event: StorageEvent) {
    const data = eventDataRecord(event.data);
    if (!data || Object.keys(data).length === 0) {
        return null;
    }

    const details: ReactNode[] = [];

    const status = data.status;
    if (typeof status === 'string' && status) {
        details.push(<span key="status">Status: {status}</span>);
    }

    const plantSortId = data.plantSortId;
    if (typeof plantSortId === 'string' && plantSortId.length) {
        details.push(<span key="plant">Biljka ID: {plantSortId}</span>);
    }

    const scheduledDate = parseDateValue(data.scheduledDate);
    if (scheduledDate) {
        details.push(
            <span key="scheduled">
                Planirano:{' '}
                <LocalDateTime time={false}>{scheduledDate}</LocalDateTime>
            </span>,
        );
    }

    const stoppedDate = parseDateValue(data.stoppedDate);
    if (stoppedDate) {
        details.push(
            <span key="stopped">
                Zaustavljeno:{' '}
                <LocalDateTime time={false}>{stoppedDate}</LocalDateTime>
            </span>,
        );
    }

    const harvestedDate = parseDateValue(
        data.harvestedDate ?? data.harvestedAt,
    );
    if (harvestedDate) {
        details.push(
            <span key="harvested">
                Ubrano:{' '}
                <LocalDateTime time={false}>{harvestedDate}</LocalDateTime>
            </span>,
        );
    }

    const analyzedAt = parseDateValue(data.analyzedAt);
    if (analyzedAt) {
        details.push(
            <span key="analyzed">
                Analizirano:{' '}
                <LocalDateTime time={false}>{analyzedAt}</LocalDateTime>
            </span>,
        );
    }

    const model = data.model;
    if (typeof model === 'string' && model) {
        details.push(<span key="model">Model: {model}</span>);
    }

    if (details.length > 0) {
        return (
            <Stack spacing={1} className="text-sm">
                {details}
            </Stack>
        );
    }

    return (
        <pre className="text-xs whitespace-pre-wrap font-mono">
            {JSON.stringify(data, null, 2)}
        </pre>
    );
}

function getEventLocationLabel(aggregateId: string, raisedBedId: number) {
    const raisedBedIdString = raisedBedId.toString();
    if (aggregateId === raisedBedIdString) {
        return 'Gredica';
    }

    const positionIndex = fieldPositionIndexFromAggregateId(
        aggregateId,
        raisedBedId,
    );
    if (positionIndex !== null) {
        return `Polje ${positionIndex + 1}`;
    }

    return aggregateId;
}

function fieldPositionOptions(
    raisedBed: NonNullable<Awaited<ReturnType<typeof getRaisedBed>>>,
    fieldEventAggregateIds: string[],
) {
    const positionIndices = new Set<number>();

    for (const field of raisedBed.fields) {
        positionIndices.add(field.positionIndex);
    }

    for (const aggregateId of fieldEventAggregateIds) {
        const positionIndex = fieldPositionIndexFromAggregateId(
            aggregateId,
            raisedBed.id,
        );
        if (positionIndex !== null) {
            positionIndices.add(positionIndex);
        }
    }

    return Array.from(positionIndices).sort((left, right) => left - right);
}

export async function RaisedBedEventsTable({
    raisedBedId,
    searchParams,
}: RaisedBedEventsTableProps) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        return <NoDataPlaceholder />;
    }

    const scope = raisedBedEventsScope(searchParams);
    const currentPage = raisedBedEventsPage(searchParams);
    const offset = (currentPage - 1) * RAISED_BED_EVENTS_PAGE_SIZE;
    const fieldAggregatePrefix = `${raisedBedId.toString()}|`;
    const fieldEventAggregateIds =
        scope === 'plants'
            ? await getEventAggregateIdsByAggregateIdPrefix(
                  PLANT_EVENT_TYPES,
                  fieldAggregatePrefix,
              )
            : [];
    const availablePositionIndices = fieldPositionOptions(
        raisedBed,
        fieldEventAggregateIds,
    );
    const selectedPositionIndex = selectedFieldPositionIndex({
        availablePositionIndices,
        scope,
        searchParams,
    });

    const eventsPage =
        scope === 'raisedBed'
            ? await getLatestEvents(
                  RAISED_BED_EVENT_TYPES,
                  [raisedBedId.toString()],
                  offset,
                  RAISED_BED_EVENTS_PAGE_SIZE + 1,
              )
            : typeof selectedPositionIndex === 'number'
              ? await getLatestEvents(
                    PLANT_EVENT_TYPES,
                    [fieldAggregateId(raisedBedId, selectedPositionIndex)],
                    offset,
                    RAISED_BED_EVENTS_PAGE_SIZE + 1,
                )
              : await getLatestEventsByAggregateIdPrefix(
                    PLANT_EVENT_TYPES,
                    fieldAggregatePrefix,
                    offset,
                    RAISED_BED_EVENTS_PAGE_SIZE + 1,
                );

    const hasNextPage = eventsPage.length > RAISED_BED_EVENTS_PAGE_SIZE;
    const events = eventsPage.slice(0, RAISED_BED_EVENTS_PAGE_SIZE);
    const hasPagination = currentPage > 1 || hasNextPage;

    return (
        <>
            <CardContent className="pb-3">
                <Stack spacing={3}>
                    <Row spacing={2} className="items-center flex-wrap gap-2">
                        <ButtonGroup legend="Vrsta događaja" size="sm">
                            <Button
                                aria-current={
                                    scope === 'raisedBed' ? 'page' : undefined
                                }
                                className={buttonGroupItemClassName({
                                    size: 'sm',
                                })}
                                color={
                                    scope === 'raisedBed'
                                        ? 'primary'
                                        : 'neutral'
                                }
                                href={buildRaisedBedEventsHref({
                                    page: 1,
                                    raisedBedId,
                                    scope: 'raisedBed',
                                    searchParams,
                                })}
                                size="sm"
                                startDecorator={<Fence className="size-4" />}
                                variant={
                                    scope === 'raisedBed' ? 'solid' : 'plain'
                                }
                            >
                                Gredica
                            </Button>
                            <Button
                                aria-current={
                                    scope === 'plants' ? 'page' : undefined
                                }
                                className={buttonGroupItemClassName({
                                    size: 'sm',
                                })}
                                color={
                                    scope === 'plants' ? 'primary' : 'neutral'
                                }
                                href={buildRaisedBedEventsHref({
                                    page: 1,
                                    raisedBedId,
                                    scope: 'plants',
                                    searchParams,
                                })}
                                size="sm"
                                startDecorator={<Sprout className="size-4" />}
                                variant={scope === 'plants' ? 'solid' : 'plain'}
                            >
                                Biljke
                            </Button>
                        </ButtonGroup>
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Stranica {currentPage}
                        </Typography>
                    </Row>
                    {scope === 'plants' && (
                        <Row
                            spacing={2}
                            className="items-center flex-wrap gap-2"
                        >
                            <Chip
                                color={
                                    selectedPositionIndex === undefined
                                        ? 'primary'
                                        : 'neutral'
                                }
                                href={buildRaisedBedEventsHref({
                                    page: 1,
                                    raisedBedId,
                                    scope,
                                    searchParams,
                                })}
                                startDecorator={<Hash className="size-3.5" />}
                                variant={
                                    selectedPositionIndex === undefined
                                        ? 'solid'
                                        : 'outlined'
                                }
                            >
                                Sva polja
                            </Chip>
                            {availablePositionIndices.map((positionIndex) => (
                                <Chip
                                    color={
                                        selectedPositionIndex === positionIndex
                                            ? 'primary'
                                            : 'neutral'
                                    }
                                    href={buildRaisedBedEventsHref({
                                        fieldPositionIndex: positionIndex,
                                        page: 1,
                                        raisedBedId,
                                        scope,
                                        searchParams,
                                    })}
                                    key={positionIndex}
                                    startDecorator={
                                        <Hash className="size-3.5" />
                                    }
                                    variant={
                                        selectedPositionIndex === positionIndex
                                            ? 'solid'
                                            : 'outlined'
                                    }
                                >
                                    Polje {positionIndex + 1}
                                </Chip>
                            ))}
                        </Row>
                    )}
                </Stack>
            </CardContent>
            <CardOverflow className="mt-0">
                <EventsTable
                    actionsColumnClassName="w-32 text-right"
                    events={events}
                    renderActions={(event) => (
                        <RaisedBedEventDeleteButton
                            eventId={event.id}
                            raisedBedId={raisedBedId}
                        />
                    )}
                    renderDetails={(event) => renderEventDetails(event)}
                    renderLocation={(event) =>
                        getEventLocationLabel(event.aggregateId, raisedBedId)
                    }
                    renderTime={(event) => (
                        <EventDateEditButton
                            date={event.createdAt}
                            onSave={updateRaisedBedEventDateAction.bind(
                                null,
                                event.id,
                                raisedBedId,
                            )}
                        />
                    )}
                    renderType={(event) =>
                        EVENT_TYPE_LABELS[event.type] ?? event.type
                    }
                />
            </CardOverflow>
            {hasPagination && (
                <CardContent className="pt-2">
                    <Row
                        spacing={3}
                        className="items-center justify-center flex-wrap"
                    >
                        {currentPage > 1 && (
                            <Chip
                                href={buildRaisedBedEventsHref({
                                    fieldPositionIndex: selectedPositionIndex,
                                    page: currentPage - 1,
                                    raisedBedId,
                                    scope,
                                    searchParams,
                                })}
                                startDecorator={
                                    <ArrowLeft className="size-4" />
                                }
                            >
                                Prethodna
                            </Chip>
                        )}
                        <Typography
                            level="body2"
                            className="text-muted-foreground"
                        >
                            Stranica {currentPage}
                        </Typography>
                        {hasNextPage && (
                            <Chip
                                href={buildRaisedBedEventsHref({
                                    fieldPositionIndex: selectedPositionIndex,
                                    page: currentPage + 1,
                                    raisedBedId,
                                    scope,
                                    searchParams,
                                })}
                                startDecorator={
                                    <ArrowRight className="size-4" />
                                }
                            >
                                Sljedeća
                            </Chip>
                        )}
                    </Row>
                </CardContent>
            )}
        </>
    );
}
