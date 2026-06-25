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
export const farmRaisedBedWeedingAutomationKey =
    'default.farm-raised-bed-weeding';
export const greenhouseSeedlingWateringAutomationKey =
    'default.greenhouse-seedling-watering';
export const monthlyFarmInventoryOperationsAutomationKey =
    'default.monthly-farm-inventory-operations';
export const raisedBedPhotoOperationsAutomationKey =
    'default.raised-bed-photo-operations';
export const raisedBedDetailedInspectionAutomationKey =
    'default.raised-bed-detailed-inspection';

const seedlingTransplantingOperationId = 593;
const plantRemovalOperationId = 346;
export const FARM_RAISED_BED_WEEDING_OPERATION_ID = 654;
export const farmRaisedBedWeedingOperationKey = 'cleanWeedsAroundRaisedBeds';
export const farmRaisedBedWeedingBiweeklyAnchorDate = '2026-01-05';
const greenhouseSeedlingWateringOperationId = 655;
export const monthlyFarmInventoryOperationConfigs = [
    { entityId: 554, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 555, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 556, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 557, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 558, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 559, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 560, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 561, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 562, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 563, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 564, entityTypeName: 'operation', scheduledInDays: 0 },
    { entityId: 565, entityTypeName: 'operation', scheduledInDays: 0 },
];
export const RAISED_BED_PHOTO_OPERATION_ID = 301;
export const RAISED_BED_PHOTO_OPERATION_NAME = 'raisedBedFullPhoto';
export const RAISED_BED_DETAILED_INSPECTION_OPERATION_ID = 652;
export const RAISED_BED_DETAILED_INSPECTION_OPERATION_NAME =
    'detailedRaisedBedInspection';

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
                    automationModuleKeys.actionUpdateRaisedBedFieldPlantAttributes,
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
                    automationModuleKeys.actionUpdateRaisedBedFieldPlantAttributes,
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

export function farmRaisedBedWeedingAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerSchedule,
                position: { x: 0, y: 160 },
                config: {
                    frequency: 'biweekly',
                    dayOfWeek: 'monday',
                    anchorDate: farmRaisedBedWeedingBiweeklyAnchorDate,
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'create-farm-weeding-operations',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionCreateFarmInventoryOperations,
                position: { x: 360, y: 160 },
                config: {
                    operations: [
                        {
                            entityId: FARM_RAISED_BED_WEEDING_OPERATION_ID,
                            entityTypeName: 'operation',
                            scheduledInDays: 0,
                        },
                    ],
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-create-farm-weeding-operations',
                source: 'trigger',
                target: 'create-farm-weeding-operations',
            },
        ],
    };
}

export function greenhouseSeedlingWateringAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerSchedule,
                position: { x: 0, y: 160 },
                config: {
                    frequency: 'daily',
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'create-greenhouse-seedling-waterings',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionCreateGreenhouseSeedlingWateringOperations,
                position: { x: 360, y: 160 },
                config: {
                    entityId: greenhouseSeedlingWateringOperationId,
                    entityTypeName: 'operation',
                    scheduledInDays: 0,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-create-greenhouse-seedling-waterings',
                source: 'trigger',
                target: 'create-greenhouse-seedling-waterings',
            },
        ],
    };
}

export function monthlyFarmInventoryOperationsAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerSchedule,
                position: { x: 0, y: 160 },
                config: {
                    frequency: 'monthly',
                    dayOfMonth: 1,
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'create-inventory-operations',
                kind: 'action',
                moduleKey:
                    automationModuleKeys.actionCreateFarmInventoryOperations,
                position: { x: 360, y: 160 },
                config: {
                    operations: monthlyFarmInventoryOperationConfigs,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-create-inventory-operations',
                source: 'trigger',
                target: 'create-inventory-operations',
            },
        ],
    };
}

export function raisedBedPhotoOperationsAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerSchedule,
                position: { x: 0, y: 160 },
                config: {
                    frequency: 'weekly',
                    daysOfWeek: ['tuesday', 'friday'],
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'create-photo-operations',
                kind: 'action',
                moduleKey: automationModuleKeys.actionCreateRaisedBedOperations,
                position: { x: 360, y: 160 },
                config: {
                    entityId: RAISED_BED_PHOTO_OPERATION_ID,
                    entityTypeName: 'operation',
                    scheduledInDays: 0,
                    acceptOnCreate: true,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-create-photo-operations',
                source: 'trigger',
                target: 'create-photo-operations',
            },
        ],
    };
}

export function raisedBedDetailedInspectionAutomationGraph(): AutomationGraph {
    return {
        nodes: [
            {
                id: 'trigger',
                kind: 'trigger',
                moduleKey: automationModuleKeys.triggerSchedule,
                position: { x: 0, y: 160 },
                config: {
                    frequency: 'weekly',
                    daysOfWeek: ['monday'],
                    timeZone: 'Europe/Zagreb',
                },
            },
            {
                id: 'create-inspection-operations',
                kind: 'action',
                moduleKey: automationModuleKeys.actionCreateRaisedBedOperations,
                position: { x: 360, y: 160 },
                config: {
                    entityId: RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
                    entityTypeName: 'operation',
                    scheduledInDays: 0,
                    acceptOnCreate: true,
                },
            },
        ],
        edges: [
            {
                id: 'trigger-to-create-inspection-operations',
                source: 'trigger',
                target: 'create-inspection-operations',
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

    const farmRaisedBedWeeding = await upsertAutomationDefinitionByKey({
        key: farmRaisedBedWeedingAutomationKey,
        name: 'Dodaj čišćenje korova oko gredica za svaku farmu',
        description:
            'Dan prije svakog drugog ponedjeljka dodaj prihvaćenu radnju na razini farme Čišćenje korova oko gredica za svaku aktivnu farmu. Definicija je pripremljena za uključivanje nakon operativnog pregleda draft radnje.',
        status: 'draft',
        graph: farmRaisedBedWeedingAutomationGraph(),
        preserveExistingStatus: true,
        metadata: {
            managedBy: 'gredice',
            defaultAutomation: true,
            operationEntityId: FARM_RAISED_BED_WEEDING_OPERATION_ID,
            operationEntityKey: farmRaisedBedWeedingOperationKey,
            biweeklyAnchorDate: farmRaisedBedWeedingBiweeklyAnchorDate,
            resolvedFromIssue: 3700,
        },
    });

    const greenhouseSeedlingWatering = await upsertAutomationDefinitionByKey({
        key: greenhouseSeedlingWateringAutomationKey,
        name: 'Dodaj dnevno zalijevanje presadnica u stakleniku',
        description:
            'Dan ranije dodaj jednu farmsku radnju zalijevanja presadnica u stakleniku za aktivne farme koje imaju presadnice u stakleniku ili aktivne outlet presadnice.',
        status: 'enabled',
        graph: greenhouseSeedlingWateringAutomationGraph(),
        metadata: {
            managedBy: 'gredice',
            defaultAutomation: true,
            operationEntityId: greenhouseSeedlingWateringOperationId,
            operationInternalName: 'waterGreenhouseSeedlings',
            operationName: 'Zalijevanje presadnica u stakleniku',
            resolvedFromIssue: 3700,
        },
    });

    const monthlyFarmInventoryOperations =
        await upsertAutomationDefinitionByKey({
            key: monthlyFarmInventoryOperationsAutomationKey,
            name: 'Mjesečna inventura farme',
            description:
                'Dan prije prvog dana u mjesecu kreiraj inventurne radnje za svaku aktivnu farmu.',
            status: 'enabled',
            graph: monthlyFarmInventoryOperationsAutomationGraph(),
            metadata: {
                managedBy: 'gredice',
                defaultAutomation: true,
                dayOfMonth: 1,
                timeZone: 'Europe/Zagreb',
                operationEntityIds: monthlyFarmInventoryOperationConfigs.map(
                    (operation) => operation.entityId,
                ),
            },
        });

    const raisedBedPhotoOperations = await upsertAutomationDefinitionByKey({
        key: raisedBedPhotoOperationsAutomationKey,
        name: 'Dodaj fotografiranje aktivnih gredica',
        description:
            'Dan prije svakog utorka i petka dodaj radnju fotografiranja za svaku aktivnu gredicu ako ta gredica već nema fotografiranje za tu pojavu rasporeda.',
        status: 'enabled',
        graph: raisedBedPhotoOperationsAutomationGraph(),
        metadata: {
            managedBy: 'gredice',
            defaultAutomation: true,
            operationEntityId: RAISED_BED_PHOTO_OPERATION_ID,
            operationEntityName: RAISED_BED_PHOTO_OPERATION_NAME,
            operationEntityLabel: 'Fotografiranje gredice',
            operationEntitySource: 'live-admin-data',
        },
    });

    const raisedBedDetailedInspection = await upsertAutomationDefinitionByKey({
        key: raisedBedDetailedInspectionAutomationKey,
        name: 'Dodaj detaljan pregled aktivnih gredica',
        description:
            'Dan prije tjednog rasporeda dodaj radnju Detaljno pregledavanje gredice za svaku aktivnu gredicu ako ta gredica već nema pregled za tu pojavu rasporeda. Definicija je pripremljena za uključivanje nakon operativnog pregleda draft radnje.',
        status: 'draft',
        graph: raisedBedDetailedInspectionAutomationGraph(),
        preserveExistingStatus: true,
        metadata: {
            managedBy: 'gredice',
            defaultAutomation: true,
            operationEntityId: RAISED_BED_DETAILED_INSPECTION_OPERATION_ID,
            operationEntityName: RAISED_BED_DETAILED_INSPECTION_OPERATION_NAME,
            operationEntityLabel: 'Detaljno pregledavanje gredice',
            dayOfWeek: 'monday',
            timeZone: 'Europe/Zagreb',
            resolvedFromIssue: 3700,
            implementsIssue: 3702,
        },
    });

    return {
        seasonalSowedWatering,
        operationImagePlantStatusReview,
        seedlingTransplantDirectSowingLocation,
        seedlingTransplantWatering,
        plantRemovalOperationStatus,
        farmRaisedBedWeeding,
        greenhouseSeedlingWatering,
        monthlyFarmInventoryOperations,
        raisedBedPhotoOperations,
        raisedBedDetailedInspection,
    };
}
