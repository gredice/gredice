import type {
    AutomationDefinitionStatus,
    AutomationGraph,
    AutomationModuleKind,
    AutomationModuleMetadata,
    AutomationRunStatus,
    AutomationStepStatus,
} from '@gredice/storage';

type ChipColor =
    | 'primary'
    | 'secondary'
    | 'error'
    | 'warning'
    | 'info'
    | 'success'
    | 'neutral';

export const automationModuleKeys = {
    actionCreateFarmInventoryOperations: 'action.createFarmInventoryOperations',
    actionCreateOperation: 'action.createOperation',
    actionCreatePlantStatusRequestsFromImageAnalysis:
        'action.createPlantStatusRequestsFromImageAnalysis',
    actionLog: 'action.log',
    actionQueueSeasonalSowingOfferOperations:
        'action.queueSeasonalSowingOfferOperations',
    actionUpdateRaisedBedFieldPlantStatus:
        'action.updateRaisedBedFieldPlantStatus',
    conditionEventDataEquals: 'condition.eventDataEquals',
    conditionOperationMatches: 'condition.operationMatches',
    conditionPlantStatusEquals: 'condition.plantStatusEquals',
    triggerDomainEvent: 'trigger.domainEvent',
    triggerScheduleMonthly: 'trigger.scheduleMonthly',
};

type AutomationConfigField = AutomationModuleMetadata['configFields'][number];
type AutomationConfigFieldOption = NonNullable<
    AutomationConfigField['options']
>[number];

type AutomationModulePresentation = {
    title: string;
    description: string;
    inputDescription?: string;
    outputDescription?: string;
    fields?: Record<
        string,
        {
            label?: string;
            description?: string;
            options?: Record<string, string>;
            placeholder?: string;
        }
    >;
};

const automationModulePresentations: Record<
    string,
    AutomationModulePresentation
> = {
    [automationModuleKeys.triggerDomainEvent]: {
        title: 'Događaj domene',
        description: 'Pokreće automatizaciju iz pohranjenog Gredice događaja.',
        inputDescription: 'Redak iz tablice događaja.',
        outputDescription: 'ID eventa, tip, ID agregata i podaci eventa.',
        fields: {
            eventType: { label: 'Tip eventa' },
        },
    },
    [automationModuleKeys.triggerScheduleMonthly]: {
        title: 'Mjesečni raspored',
        description:
            'Pokreće automatizaciju jednom mjesečno na odabrani lokalni dan.',
        inputDescription:
            'Mjesečna pojava koju generira runner automatizacija.',
        outputDescription:
            'Ključ mjesečne pojave i konfigurirani lokalni datum.',
        fields: {
            dayOfMonth: { label: 'Dan u mjesecu' },
            timeZone: { label: 'Vremenska zona' },
        },
    },
    [automationModuleKeys.conditionEventDataEquals]: {
        title: 'Usporedba podataka eventa',
        description: 'Provjerava vrijednost u podacima eventa prije nastavka.',
        fields: {
            path: { label: 'Putanja podataka' },
            operator: {
                label: 'Operator',
                options: {
                    equals: 'Jednako',
                    notEquals: 'Nije jednako',
                    exists: 'Postoji',
                    notExists: 'Ne postoji',
                },
            },
            value: { label: 'Vrijednost' },
        },
    },
    [automationModuleKeys.conditionOperationMatches]: {
        title: 'Provjera radnje',
        description:
            'Provjerava status radnje ili metapodatke iz direktorija radnji.',
        fields: {
            status: { label: 'Status radnje' },
            entityId: { label: 'ID entiteta radnje' },
            application: { label: 'Aplikacija radnje' },
        },
    },
    [automationModuleKeys.conditionPlantStatusEquals]: {
        title: 'Provjera statusa biljke',
        description: 'Provjerava trenutačni status biljke u polju gredice.',
        fields: {
            status: { label: 'Status biljke' },
        },
    },
    [automationModuleKeys.actionQueueSeasonalSowingOfferOperations]: {
        title: 'Sezonska zalijevanja',
        description:
            'Dodaje trenutačnu sezonsku ponudu besplatnog zalijevanja nakon sjetve.',
        inputDescription:
            'Event `raisedBedField.plantUpdate` s agregatom `raisedBedId|positionIndex`.',
        outputDescription: 'ID-jevi kreiranih radnji ili razlog preskakanja.',
    },
    [automationModuleKeys.actionCreateOperation]: {
        title: 'Kreiraj radnju',
        description: 'Kreira Gredice radnju za trenutačni kontekst eventa.',
        fields: {
            entityId: { label: 'ID entiteta radnje' },
            entityTypeName: { label: 'Tip entiteta' },
            scheduledInDays: { label: 'Zakaži nakon dana' },
        },
    },
    [automationModuleKeys.actionCreateFarmInventoryOperations]: {
        title: 'Radnje inventara farme',
        description:
            'Kreira konfigurirane inventurne zadatke za svaku aktivnu farmu.',
        inputDescription: 'Mjesečna pojava rasporeda.',
        outputDescription:
            'ID-jevi kreiranih radnji i broj preskočenih postojećih radnji.',
        fields: {
            operations: {
                label: 'Radnje',
                description:
                    'JSON niz: [{"entityId": 123, "entityTypeName": "operation", "scheduledInDays": 0}]',
            },
        },
    },
    [automationModuleKeys.actionUpdateRaisedBedFieldPlantStatus]: {
        title: 'Ažuriraj status biljke',
        description: 'Upisuje novi status biljke za ciljano polje gredice.',
        fields: {
            targetStatus: { label: 'Ciljani status' },
        },
    },
    [automationModuleKeys.actionCreatePlantStatusRequestsFromImageAnalysis]: {
        title: 'Provjeri fotografije gredice',
        description:
            'Analizira fotografije gredice i kreira zahtjeve za potvrdu pouzdanih promjena statusa biljke.',
        inputDescription:
            'Event završetka radnje s učitanim fotografijama ili event AI analize gredice.',
        outputDescription:
            'ID-jevi zahtjeva, preskočeni prijedlozi, potrošnja tokena i sažetak provjere.',
        fields: {
            minConfidence: {
                label: 'Minimalna pouzdanost',
                description:
                    'Samo prijedlozi s ovom pouzdanošću ili većom kreiraju zahtjeve.',
            },
            requestedBy: { label: 'Zatražio' },
        },
    },
    [automationModuleKeys.actionLog]: {
        title: 'Zapiši poruku',
        description:
            'Bilježi rezultat bez promjene podataka za testiranje putanje.',
        fields: {
            message: {
                label: 'Poruka',
                placeholder: 'Automatizacija je došla do ovog koraka.',
            },
        },
    },
};

function automationModulePresentation(moduleKey: string) {
    return automationModulePresentations[moduleKey];
}

export function automationModuleKindLabel(kind: AutomationModuleKind) {
    switch (kind) {
        case 'trigger':
            return 'Okidač';
        case 'filter':
            return 'Filter';
        case 'condition':
            return 'Uvjet';
        case 'action':
            return 'Akcija';
    }
}

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
            return { label: 'U redu čekanja', color: 'neutral' };
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

export function automationStepStatusMeta(status: AutomationStepStatus): {
    label: string;
    color: ChipColor;
} {
    switch (status) {
        case 'pending':
            return { label: 'Na čekanju', color: 'neutral' };
        case 'running':
            return { label: 'Izvodi se', color: 'info' };
        case 'succeeded':
            return { label: 'Uspješno', color: 'success' };
        case 'skipped':
            return { label: 'Preskočeno', color: 'neutral' };
        case 'failed':
            return { label: 'Greška', color: 'error' };
    }
}

export function moduleMetadataByKey(modules: AutomationModuleMetadata[]) {
    return new Map(modules.map((module) => [module.key, module]));
}

export function automationModuleTitle(module: AutomationModuleMetadata) {
    return automationModulePresentation(module.key)?.title ?? module.title;
}

export function automationModuleDescription(module: AutomationModuleMetadata) {
    return (
        automationModulePresentation(module.key)?.description ??
        module.description
    );
}

export function automationModuleInputDescription(
    module: AutomationModuleMetadata,
) {
    return (
        automationModulePresentation(module.key)?.inputDescription ??
        module.inputDescription
    );
}

export function automationModuleOutputDescription(
    module: AutomationModuleMetadata,
) {
    return (
        automationModulePresentation(module.key)?.outputDescription ??
        module.outputDescription
    );
}

export function automationConfigFieldLabel(
    module: AutomationModuleMetadata,
    field: AutomationConfigField,
) {
    return (
        automationModulePresentation(module.key)?.fields?.[field.key]?.label ??
        field.label
    );
}

export function automationConfigFieldDescription(
    module: AutomationModuleMetadata,
    field: AutomationConfigField,
) {
    return (
        automationModulePresentation(module.key)?.fields?.[field.key]
            ?.description ?? field.description
    );
}

export function automationConfigFieldPlaceholder(
    module: AutomationModuleMetadata,
    field: AutomationConfigField,
) {
    return (
        automationModulePresentation(module.key)?.fields?.[field.key]
            ?.placeholder ?? field.placeholder
    );
}

export function automationConfigFieldOptionLabel({
    field,
    module,
    option,
}: {
    field: AutomationConfigField;
    module: AutomationModuleMetadata;
    option: AutomationConfigFieldOption;
}) {
    return (
        automationModulePresentation(module.key)?.fields?.[field.key]
            ?.options?.[option.value] ?? option.label
    );
}

export function automationTriggerSummary(
    graph: AutomationGraph,
    modules: Map<string, AutomationModuleMetadata>,
) {
    const trigger = graph.nodes.find((node) => node.kind === 'trigger');
    if (!trigger) {
        return 'Nema okidača';
    }

    const module = modules.get(trigger.moduleKey);
    const moduleTitle = module
        ? automationModuleTitle(module)
        : trigger.moduleKey;
    if (trigger.moduleKey === automationModuleKeys.triggerScheduleMonthly) {
        const dayOfMonth = trigger.config.dayOfMonth;
        const timeZone = trigger.config.timeZone;
        const dayText =
            typeof dayOfMonth === 'number' ? dayOfMonth.toString() : '?';
        const timeZoneText =
            typeof timeZone === 'string' && timeZone.trim().length > 0
                ? timeZone
                : 'Europe/Zagreb';

        return `${moduleTitle}: dan ${dayText} (${timeZoneText})`;
    }

    const eventType = trigger.config.eventType;
    const eventTypeText =
        typeof eventType === 'string' && eventType.trim().length > 0
            ? eventType
            : 'bez tipa eventa';

    return `${moduleTitle}: ${eventTypeText}`;
}

export function automationActionSummary(
    graph: AutomationGraph,
    modules: Map<string, AutomationModuleMetadata>,
) {
    const actionNames = graph.nodes
        .filter((node) => node.kind === 'action')
        .map((node) => {
            const module = modules.get(node.moduleKey);
            return module ? automationModuleTitle(module) : node.moduleKey;
        });

    if (actionNames.length === 0) {
        return 'Nema akcija';
    }

    return actionNames.join(', ');
}
