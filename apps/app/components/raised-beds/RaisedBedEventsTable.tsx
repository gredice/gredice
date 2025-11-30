import {
    getEvents,
    getRaisedBed,
    knownEventTypes,
    type RaisedBedFieldPlantEventPayload,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@signalco/ui-primitives/Stack';
import type { ReactNode } from 'react';
import { EventsTable } from '../shared/events/EventsTable';
import { NoDataPlaceholder } from '../shared/placeholders/NoDataPlaceholder';
import { RaisedBedEventDeleteButton } from './RaisedBedEventDeleteButton';

interface RaisedBedEventsTableProps {
    raisedBedId: number;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    [knownEventTypes.raisedBeds.create]: 'Gredica stvorena',
    [knownEventTypes.raisedBeds.place]: 'Gredica postavljena',
    [knownEventTypes.raisedBeds.delete]: 'Gredica obrisana',
    [knownEventTypes.raisedBeds.abandon]: 'Gredica napuštena',
    [knownEventTypes.raisedBedFields.create]: 'Polje stvoreno',
    [knownEventTypes.raisedBedFields.delete]: 'Polje obrisano',
    [knownEventTypes.raisedBedFields.plantPlace]: 'Biljka postavljena',
    [knownEventTypes.raisedBedFields.plantUpdate]: 'Biljka ažurirana',
    [knownEventTypes.raisedBedFields.plantReplaceSort]: 'Biljka promijenjena',
};

type StorageEvent = Awaited<ReturnType<typeof getEvents>>[number];

const EVENT_TYPES = [
    knownEventTypes.raisedBeds.create,
    knownEventTypes.raisedBeds.place,
    knownEventTypes.raisedBeds.delete,
    knownEventTypes.raisedBeds.abandon,
    knownEventTypes.raisedBedFields.create,
    knownEventTypes.raisedBedFields.delete,
    knownEventTypes.raisedBedFields.plantPlace,
    knownEventTypes.raisedBedFields.plantUpdate,
    knownEventTypes.raisedBedFields.plantReplaceSort,
];

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

function renderEventDetails(event: StorageEvent) {
    const data = event.data as
        | RaisedBedFieldPlantEventPayload
        | null
        | undefined;
    if (!data || Object.keys(data).length === 0) {
        return null;
    }

    const details: ReactNode[] = [];

    if ('status' in data && data.status) {
        details.push(<span key="status">Status: {data.status}</span>);
    }

    if ('plantSortId' in data && data.plantSortId.length) {
        details.push(<span key="plant">Biljka ID: {data.plantSortId}</span>);
    }

    const scheduledDate = parseDateValue(
        'scheduledDate' in data ? data.scheduledDate : undefined,
    );
    if (scheduledDate) {
        details.push(
            <span key="scheduled">
                Planirano:{' '}
                <LocalDateTime time={false}>{scheduledDate}</LocalDateTime>
            </span>,
        );
    }

    const stoppedDate = parseDateValue(
        'stoppedDate' in data ? data.stoppedDate : undefined,
    );
    if (stoppedDate) {
        details.push(
            <span key="stopped">
                Zaustavljeno:{' '}
                <LocalDateTime time={false}>{stoppedDate}</LocalDateTime>
            </span>,
        );
    }

    const harvestedDate = parseDateValue(
        'harvestedDate' in data
            ? data.harvestedDate
            : 'harvestedAt' in data
              ? data.harvestedAt
              : undefined,
    );
    if (harvestedDate) {
        details.push(
            <span key="harvested">
                Ubrano:{' '}
                <LocalDateTime time={false}>{harvestedDate}</LocalDateTime>
            </span>,
        );
    }

    if (details.length > 0) {
        return (
            <Stack spacing={0.5} className="text-sm">
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

    if (aggregateId.startsWith(`${raisedBedIdString}|`)) {
        const [, positionIndexRaw] = aggregateId.split('|');
        const positionIndex = Number.parseInt(positionIndexRaw ?? '', 10);
        if (Number.isFinite(positionIndex)) {
            return `Polje ${positionIndex + 1}`;
        }
    }

    return aggregateId;
}

export async function RaisedBedEventsTable({
    raisedBedId,
}: RaisedBedEventsTableProps) {
    const raisedBed = await getRaisedBed(raisedBedId);
    if (!raisedBed) {
        return <NoDataPlaceholder />;
    }

    const aggregateIds = new Set<string>([raisedBedId.toString()]);
    for (const field of raisedBed.fields) {
        aggregateIds.add(`${field.raisedBedId}|${field.positionIndex}`);
    }

    const events = aggregateIds.size
        ? await getEvents(EVENT_TYPES, Array.from(aggregateIds), 0, 10000)
        : [];

    const sortedEvents = [...events].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    return (
        <EventsTable
            events={sortedEvents}
            renderType={(event) => EVENT_TYPE_LABELS[event.type] ?? event.type}
            renderDetails={(event) => renderEventDetails(event)}
            renderLocation={(event) =>
                getEventLocationLabel(event.aggregateId, raisedBedId)
            }
            renderActions={(event) => (
                <RaisedBedEventDeleteButton
                    eventId={event.id}
                    raisedBedId={raisedBedId}
                />
            )}
            actionsColumnClassName="w-32 text-right"
        />
    );
}
