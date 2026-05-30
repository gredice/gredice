import { upsertAutomationDefinitionByKey } from '../repositories/automationsRepo';
import { knownEventTypes } from '../repositories/events/knownEventTypes';
import type { AutomationGraph } from '../schema';
import { automationModuleKeys } from './modules';

export const seasonalSowedWateringAutomationKey =
    'default.seasonal-sowed-watering';

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

export async function ensureDefaultAutomationDefinitions() {
    const seasonalSowedWatering = await upsertAutomationDefinitionByKey({
        key: seasonalSowedWateringAutomationKey,
        name: 'Queue seasonal waterings when planting is sowed',
        description:
            'When a raised-bed field plant update marks a planting as sowed, queue the current seasonal free watering offer for that raised bed.',
        status: 'enabled',
        graph: seasonalSowedWateringAutomationGraph(),
        metadata: {
            managedBy: 'gredice',
            defaultAutomation: true,
        },
    });

    return {
        seasonalSowedWatering,
    };
}
