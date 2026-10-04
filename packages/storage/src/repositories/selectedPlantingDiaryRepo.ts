import 'server-only';
import { plantFieldStatusLabel } from '@gredice/js/plants';
import type { EntityStandardized } from '../@types/EntityStandardized';
import { storage } from '../storage';
import { getEntitiesFormatted } from './entitiesRepo';
import { getAllEvents, knownEventTypes } from './eventsRepo';
import { getOperations } from './operationsRepo';
import { getRaisedBedPlanting } from './raisedBedPlantingsRepo';
import {
    getSelectedRaisedBedPlantingTaskForOwner,
    type SelectedRaisedBedPlantingOwner,
} from './raisedBedPlantingTasksRepo';

export async function getSelectedPlantingDiaryEntries(input: {
    plantingId: number;
    raisedBedId: number;
    owner: SelectedRaisedBedPlantingOwner;
}) {
    const definitions =
        await getEntitiesFormatted<EntityStandardized>('operation');
    return storage().transaction(async (db) => {
        const task = await getSelectedRaisedBedPlantingTaskForOwner(input, db);
        const planting = await getRaisedBedPlanting(input.plantingId, db);
        if (!planting || planting.raisedBedId !== input.raisedBedId)
            throw new Error('Planting not found.');
        const [events, operations] = await Promise.all([
            getAllEvents(
                Object.values(knownEventTypes.raisedBedPlantings),
                [planting.eventAggregateId],
                { db },
            ),
            getOperations(
                input.owner.accountId,
                undefined,
                planting.raisedBedId,
                undefined,
                db,
            ),
        ]);
        const labels = new Map(
            definitions.map((entity) => [
                entity.id,
                entity.information?.label ?? entity.information?.name,
            ]),
        );
        const entries = events.flatMap((event) => {
            const data = event.data;
            if (typeof data !== 'object' || !data) return [];
            let name: string;
            let description = '';
            let imageUrls: string[] = [];
            const status =
                'status' in data && typeof data.status === 'string'
                    ? data.status
                    : null;
            switch (event.type) {
                case knownEventTypes.raisedBedPlantings.lifecycleStarted:
                    name = 'Zatraženo sijanje biljke';
                    break;
                case knownEventTypes.raisedBedPlantings.taskScheduled:
                    name = 'Ažuriran termin sijanja';
                    break;
                case knownEventTypes.raisedBedPlantings.taskCompleted:
                    name =
                        status === 'sowed'
                            ? 'Biljka je posijana'
                            : 'Sijanje čeka provjeru';
                    if (
                        task.status === 'completed' &&
                        'images' in data &&
                        Array.isArray(data.images)
                    )
                        imageUrls = data.images.filter(
                            (url): url is string => typeof url === 'string',
                        );
                    break;
                case knownEventTypes.raisedBedPlantings.taskVerified:
                    name = 'Sijanje je potvrđeno';
                    break;
                case knownEventTypes.raisedBedPlantings.taskCancelled:
                    name = 'Sijanje je otkazano';
                    break;
                case knownEventTypes.raisedBedPlantings.taskBlocked:
                    name = 'Sijanje je blokirano';
                    description =
                        'reasonLabel' in data &&
                        typeof data.reasonLabel === 'string'
                            ? data.reasonLabel
                            : '';
                    break;
                case knownEventTypes.raisedBedPlantings.sortCorrected:
                    name = 'Ispravljena sorta biljke';
                    break;
                case knownEventTypes.raisedBedPlantings.transplanted:
                    name = 'Biljka je presađena u gredicu';
                    break;
                case knownEventTypes.raisedBedPlantings.lifecycleStatusChanged:
                    if (!status) return [];
                    name = plantFieldStatusLabel(status).label;
                    description = plantFieldStatusLabel(status).description;
                    break;
                default:
                    return [];
            }
            const effectiveAt =
                'effectiveAt' in data && typeof data.effectiveAt === 'string'
                    ? new Date(data.effectiveAt)
                    : event.createdAt;
            return [
                {
                    id: event.id,
                    name,
                    description,
                    status: null,
                    timestamp: Number.isFinite(effectiveAt.getTime())
                        ? effectiveAt
                        : event.createdAt,
                    imageUrls,
                },
            ];
        });
        const operationEntries = operations
            .filter((op) => op.plantingId === planting.id)
            .map((op) => ({
                id: -op.id,
                name: labels.get(op.entityId) ?? 'Radnja na biljci',
                description: '',
                status:
                    op.status === 'completed'
                        ? 'Dovršeno'
                        : op.status === 'pendingVerification'
                          ? 'Čeka provjeru'
                          : op.status === 'canceled'
                            ? 'Otkazano'
                            : op.status === 'blocked'
                              ? 'Blokirano'
                              : 'Planirano',
                timestamp: op.completedAt ?? op.scheduledDate ?? op.createdAt,
                imageUrls:
                    op.status === 'completed' ? (op.imageUrls ?? []) : [],
            }));
        return [...entries, ...operationEntries].sort(
            (a, b) =>
                b.timestamp.getTime() - a.timestamp.getTime() || b.id - a.id,
        );
    });
}
