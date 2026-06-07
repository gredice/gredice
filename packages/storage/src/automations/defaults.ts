import {
    initializeAutomationEventCursorToLatest,
    upsertAutomationDefinitionByKey,
} from '../repositories/automationsRepo';
import { knownEventTypes } from '../repositories/events/knownEventTypes';
import type { AutomationGraph } from '../schema';
import { automationModuleKeys } from './modules';

export const seasonalSowedWateringAutomationKey =
    'default.seasonal-sowed-watering';
export const operationImagePlantStatusReviewAutomationKey =
    'default.operation-image-plant-status-review';
export const seedlingTransplantDirectSowingLocationAutomationKey =
    'default.seedling-transplant-direct-sowing-location';

const seedlingTransplantingOperationId = 593;

export function seasonalSowedWateringAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerDomainEvent,
                position: { x: 0, y: 120 },
                config: {
                    eventType: knownEventTypes.raisedBedFields.plantUpdate,
                },
            },
            {
                id: 'status-is-sowed',
                kind: 'condition',
                moduleKey: automationModuleKeys.conditionEventDataEquals,
                position: { x: 280, y: 120 },
                config: {
                    path: 'status',
                    operator: 'equals',
                    value: 'sowed',
                },
            },
            {
                id: 'queue-seasonal-waterings',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionQueueSeasonalSowingOfferOperations,
                position: { x: 620, y: 120 },
                config: {},
            },
        ],
        edges: [
            {
                id: 'trigger-to-status',
                source: 'trigger',
                target: 'status-is-sowed',
            },
            {
                id: 'status-to-action',
                source: 'status-is-sowed',
                target: 'queue-seasonal-waterings',
            },
        ],
    };
}

export function operationImagePlantStatusReviewAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerDomainEvent,
                position: { x: 0, y: 160 },
                config: {
                    eventType: knownEventTypes.operations.complete,
                },
            },
            {
                id: 'has-images',
                kind: 'condition',
                moduleKey: automationModuleKeys.conditionEventDataEquals,
                position: { x: 280, y: 160 },
                config: {
                    path: 'images',
                    operator: 'exists',
                },
            },
            {
                id: 'review-plant-statuses',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionCreatePlantStatusRequestsFromImageAnalysis,
                position: { x: 620, y: 160 },
                config: {
                    minConfidence: 0.9,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-images',
                source: 'trigger',
                target: 'has-images',
            },
            {
                id: 'images-to-review',
                source: 'has-images',
                target: 'review-plant-statuses',
            },
        ],
    };
}

export function seedlingTransplantDirectSowingLocationAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerDomainEvent,
                position: { x: 0, y: 160 },
                config: {
                    eventType: knownEventTypes.operations.complete,
                },
            },
            {
                id: 'operation-is-seedling-transplant',
                kind: 'condition',
                moduleKey: automationModuleKeys.conditionOperationMatches,
                position: { x: 280, y: 160 },
                config: {
                    entityId: seedlingTransplantingOperationId,
                },
            },
            {
                id: 'set-location-direct',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionUpdateRaisedBedFieldSowingLocation,
                position: { x: 620, y: 160 },
                config: {
                    targetSowingLocation: 'direct',
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-operation-match',
                source: 'trigger',
                target: 'operation-is-seedling-transplant',
            },
            {
                id: 'operation-match-to-set-location',
                source: 'operation-is-seedling-transplant',
                target: 'set-location-direct',
            },
        ],
    };
}

export async function ensureDefaultAutomationDefinitions() {
    await initializeAutomationEventCursorToLatest();

    const seasonalSowedWatering = await upsertAutomationDefinitionByKey({
        key: seasonalSowedWateringAutomationKey,
        name: 'Dodaj sezonska zalijevanja nakon sjetve',
        description:
            'Kada ažuriranje polja gredice označi biljku kao posijanu, dodaj trenutačnu sezonsku ponudu besplatnog zalijevanja za tu gredicu.',
        status: 'enabled',
        graph: seasonalSowedWateringAutomationGraph(),
        metadata: {
            managedBy: 'gredice',
            defaultAutomation: true,
        },
    });

    const operationImagePlantStatusReview =
        await upsertAutomationDefinitionByKey({
            key: operationImagePlantStatusReviewAutomationKey,
            name: 'Provjeri fotografije radnje za promjene statusa biljke',
            description:
                'Kada je radnja na gredici završena s fotografijama, analiziraj fotografije i kreiraj zahtjeve za potvrdu pouzdanih promjena statusa biljke.',
            status: 'enabled',
            graph: operationImagePlantStatusReviewAutomationGraph(),
            metadata: {
                managedBy: 'gredice',
                defaultAutomation: true,
            },
        });

    const seedlingTransplantDirectSowingLocation =
        await upsertAutomationDefinitionByKey({
            key: seedlingTransplantDirectSowingLocationAutomationKey,
            name: 'Postavi sadnice nakon presađivanja na direktnu sjetvu',
            description:
                'Kada je radnja presađivanja sadnica završena, prebaci lokaciju sijanja ciljane biljke iz staklenika na direktnu sjetvu.',
            status: 'enabled',
            graph: seedlingTransplantDirectSowingLocationAutomationGraph(),
            metadata: {
                managedBy: 'gredice',
                defaultAutomation: true,
                operationEntityId: seedlingTransplantingOperationId,
            },
        });

    return {
        seasonalSowedWatering,
        operationImagePlantStatusReview,
        seedlingTransplantDirectSowingLocation,
    };
}
