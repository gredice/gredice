import type {
    AutomationDefinitionStatus,
    AutomationGraph,
    AutomationModuleMetadata,
    AutomationRunStatus,
} from '@gredice/storage';

type ChipColor =
    | 'primary'
    | 'secondary'
    | 'error'
    | 'warning'
    | 'info'
    | 'success'
    | 'neutral';

export function automationStatusMeta(status: AutomationDefinitionStatus): {
    label: string;
    color: ChipColor;
} {
    switch (status) {
        case 'enabled':
            return { label: 'Uključena', color: 'success' };
        case 'disabled':
            return { label: 'Isključena', color: 'warning' };
        case 'archived':
            return { label: 'Arhivirana', color: 'neutral' };
        case 'draft':
            return { label: 'Skica', color: 'info' };
    }
}

export function automationRunStatusMeta(status: AutomationRunStatus): {
    label: string;
    color: ChipColor;
} {
    switch (status) {
        case 'queued':
            return { label: 'U redu', color: 'neutral' };
        case 'running':
            return { label: 'Izvodi se', color: 'info' };
        case 'succeeded':
            return { label: 'Uspjela', color: 'success' };
        case 'skipped':
            return { label: 'Preskočena', color: 'neutral' };
        case 'failed':
            return { label: 'Greška', color: 'error' };
        case 'retrying':
            return { label: 'Ponavlja se', color: 'warning' };
        case 'canceled':
            return { label: 'Otkazana', color: 'neutral' };
    }
}

export function moduleMetadataByKey(modules: AutomationModuleMetadata[]) {
    return new Map(modules.map((module) => [module.key, module]));
}

export function automationTriggerSummary(
    graph: AutomationGraph,
    modules: Map<string, AutomationModuleMetadata>,
) {
    const trigger = graph.nodes.find((node) => node.kind === 'trigger');
    if (!trigger) {
        return 'Nema triggera';
    }

    const module = modules.get(trigger.moduleKey);
    const eventType = trigger.config.eventType;
    const eventTypeText =
        typeof eventType === 'string' && eventType.trim().length > 0
            ? eventType
            : 'bez tipa eventa';

    return `${module?.title ?? trigger.moduleKey}: ${eventTypeText}`;
}

export function automationActionSummary(
    graph: AutomationGraph,
    modules: Map<string, AutomationModuleMetadata>,
) {
    const actionNames = graph.nodes
        .filter((node) => node.kind === 'action')
        .map((node) => modules.get(node.moduleKey)?.title ?? node.moduleKey);

    if (actionNames.length === 0) {
        return 'Nema akcija';
    }

    return actionNames.join(', ');
}
