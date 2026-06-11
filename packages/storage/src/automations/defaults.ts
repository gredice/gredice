import {
    initializeAutomationEventCursorToLatest,
    upsertAutomationDefinitionByKey,
} from '../repositories/automationsRepo';
import { knownEventTypes } from '../repositories/events/knownEventTypes';
import { RAISED_BED_WATERING_50L_OPERATION_ID } from '../repositories/seasonalOffersRepo';
import type { AutomationGraph } from '../schema';
import { automationModuleKeys } from './modules';

export const seasonalSowedWateringAutomationKey =
    'default.seasonal-sowed-watering';
export const operationImagePlantStatusReviewAutomationKey =
    'default.operation-image-plant-status-review';
export const seedlingTransplantDirectSowingLocationAutomationKey =
    'default.seedling-transplant-direct-sowing-location';
export const seedlingTransplantWateringAutomationKey =
    'default.seedling-transplant-watering';
export const plantRemovalOperationStatusAutomationKey =
    'default.plant-removal-operation-status';

const seedlingTransplantingOperationId = 593;
const plantRemovalOperationId = 346;

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
                    eventType: knownEventTypes.operations.verify,
                },
            },
            {
                id: 'operation-is-seedling-transplant',
                kind: 'condition',
                moduleKey: automationModuleKeys.conditionOperationMatches,
                position: { x: 280, y: 160 },
                config: {
                    status: 'completed',
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

export function seedlingTransplantWateringAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerDomainEvent,
                position: { x: 0, y: 160 },
                config: {
                    eventType: knownEventTypes.operations.verify,
                },
            },
            {
                id: 'operation-is-seedling-transplant',
                kind: 'condition',
                moduleKey: automationModuleKeys.conditionOperationMatches,
                position: { x: 280, y: 160 },
                config: {
                    status: 'completed',
                    entityId: seedlingTransplantingOperationId,
                },
            },
            {
                id: 'queue-transplant-waterings',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionQueuePostTransplantWateringOperations,
                position: { x: 620, y: 160 },
                config: {},
            },
        ],
        edges: [
            {
                id: 'trigger-to-operation-match',
                source: 'trigger',
                target: 'operation-is-seedling-transplant',
            },
            {
                id: 'operation-match-to-waterings',
                source: 'operation-is-seedling-transplant',
                target: 'queue-transplant-waterings',
            },
        ],
    };
}

export function plantRemovalOperationStatusAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerDomainEvent,
                position: { x: 0, y: 160 },
                config: {
                    eventType: knownEventTypes.operations.verify,
                },
            },
            {
                id: 'operation-is-plant-removal',
                kind: 'condition',
                moduleKey: automationModuleKeys.conditionOperationMatches,
                position: { x: 280, y: 160 },
                config: {
                    status: 'completed',
                    entityId: plantRemovalOperationId,
                },
            },
            {
                id: 'set-plant-status-removed',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionUpdateRaisedBedFieldPlantStatus,
                position: { x: 620, y: 160 },
                config: {
                    targetStatus: 'removed',
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-operation-match',
                source: 'trigger',
                target: 'operation-is-plant-removal',
            },
            {
                id: 'operation-match-to-set-removed',
                source: 'operation-is-plant-removal',
                target: 'set-plant-status-removed',
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
            name: 'Postavi sadnice nakon potvrde presađivanja na direktnu sjetvu',
            description:
                'Kada je radnja presađivanja sadnica potvrđena, prebaci lokaciju sijanja ciljane biljke iz staklenika na direktnu sjetvu.',
            status: 'enabled',
            graph: seedlingTransplantDirectSowingLocationAutomationGraph(),
            metadata: {
                managedBy: 'gredice',
                defaultAutomation: true,
                operationEntityId: seedlingTransplantingOperationId,
            },
        });

    const seedlingTransplantWatering = await upsertAutomationDefinitionByKey({
        key: seedlingTransplantWateringAutomationKey,
        name: 'Dodaj zalijevanja nakon potvrde presađivanja sadnice',
        description:
            'Kada je radnja presađivanja sadnica potvrđena, dodaj 50L zalijevanje za ciljanu gredicu za sljedeća dva dana ako taj dan već nema barem 50L zalijevanja.',
        status: 'enabled',
        graph: seedlingTransplantWateringAutomationGraph(),
        metadata: {
            managedBy: 'gredice',
            defaultAutomation: true,
            operationEntityId: seedlingTransplantingOperationId,
            wateringOperationEntityId: RAISED_BED_WATERING_50L_OPERATION_ID,
        },
    });

    const plantRemovalOperationStatus = await upsertAutomationDefinitionByKey({
        key: plantRemovalOperationStatusAutomationKey,
        name: 'Označi biljku uklonjenom nakon potvrde uklanjanja',
        description:
            'Kada je radnja uklanjanja biljke potvrđena, postavi status ciljane biljke na uklonjeno.',
        status: 'enabled',
        graph: plantRemovalOperationStatusAutomationGraph(),
        metadata: {
            managedBy: 'gredice',
            defaultAutomation: true,
            operationEntityId: plantRemovalOperationId,
            targetStatus: 'removed',
        },
    });

    return {
        seasonalSowedWatering,
        operationImagePlantStatusReview,
        seedlingTransplantDirectSowingLocation,
        seedlingTransplantWatering,
        plantRemovalOperationStatus,
    };
}
