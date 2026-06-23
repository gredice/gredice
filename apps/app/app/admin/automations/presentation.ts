import type {
    AutomationDefinitionStatus,
    AutomationGraph,
    AutomationModuleKind,
    AutomationModuleMetadata,
    AutomationRunSource,
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
    actionQueuePostTransplantWateringOperations:
        'action.queuePostTransplantWateringOperations',
    actionQueueSeasonalSowingOfferOperations:
        'action.queueSeasonalSowingOfferOperations',
    actionUpdateRaisedBedFieldPlantAttributes:
        'action.updateRaisedBedFieldPlantAttributes',
    conditionEventDataEquals: 'condition.eventDataEquals',
    conditionOperationMatches: 'condition.operationMatches',
    conditionPlantStatusEquals: 'condition.plantStatusEquals',
    triggerDomainEvent: 'trigger.domainEvent',
    triggerSchedule: 'trigger.schedule',
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
    [automationModuleKeys.triggerSchedule]: {
        title: 'Raspored',
        description:
            'Pokreće automatizaciju po dnevnom, tjednom, dvotjednom ili mjesečnom rasporedu.',
        inputDescription: 'Pojava rasporeda koju generira runner.',
        outputDescription:
            'Ključ pojave rasporeda i konfigurirani lokalni datum.',
        fields: {
            frequency: {
                label: 'Učestalost',
                options: {
                    daily: 'Dnevno',
                    weekly: 'Tjedno',
                    biweekly: 'Svaka dva tjedna',
                    monthly: 'Mjesečno',
                },
            },
            dayOfWeek: {
                label: 'Dan u tjednu',
                description:
                    'Za tjedne i dvotjedne rasporede. Za više dana koristite polje Dani u tjednu.',
                options: {
                    monday: 'Ponedjeljak',
                    tuesday: 'Utorak',
                    wednesday: 'Srijeda',
                    thursday: 'Četvrtak',
                    friday: 'Petak',
                    saturday: 'Subota',
                    sunday: 'Nedjelja',
                },
            },
            daysOfWeek: {
                label: 'Dani u tjednu',
                description:
                    'JSON niz za više dana, npr. ["tuesday", "friday"].',
            },
            anchorDate: {
                label: 'Referentni datum',
                description:
                    'Obavezno za dvotjedni raspored. Format: YYYY-MM-DD.',
            },
            dayOfMonth: {
                label: 'Dan u mjesecu',
                description: 'Obavezno za mjesečni raspored.',
            },
            timeZone: { label: 'Vremenska zona' },
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
    [automationModuleKeys.actionQueuePostTransplantWateringOperations]: {
        title: 'Zalijevanja nakon presađivanja',
        description:
            'Dodaje 50L zalijevanja za dva dana nakon potvrđenog presađivanja sadnice.',
        inputDescription:
            'Event `operation.verify` za radnju presađivanja sadnice s ciljanom gredicom.',
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
    [automationModuleKeys.actionUpdateRaisedBedFieldPlantAttributes]: {
        title: 'Ažuriraj biljku u gredici',
        description:
            'Upisuje status biljke i/ili lokaciju sijanja za ciljano polje gredice.',
        inputDescription: 'Event radnje s ciljanom gredicom i poljem gredice.',
        outputDescription: 'Ažurirani atributi biljke ili razlog preskakanja.',
        fields: {
            targetStatus: {
                label: 'Ciljani status',
                placeholder: 'sprouted',
            },
            targetSowingLocation: {
                label: 'Ciljana lokacija sijanja',
                description: 'Neobavezno. Vrijednosti: direct, greenhouse.',
                options: {
                    '': 'Bez promjene',
                    direct: 'Direktno',
                    greenhouse: 'Staklenik',
                },
                placeholder: 'direct',
            },
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

export function automationRunSourceLabel(source: AutomationRunSource) {
    switch (source) {
        case 'event':
            return 'Event';
        case 'manual':
            return 'Ručno';
        case 'schedule':
            return 'Raspored';
        case 'test':
            return 'Test';
        case 'replay':
            return 'Ponovljeno';
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

const weekDayLabels: Record<string, string> = {
    friday: 'petak',
    monday: 'ponedjeljak',
    saturday: 'subota',
    sunday: 'nedjelja',
    thursday: 'četvrtak',
    tuesday: 'utorak',
    wednesday: 'srijeda',
};

function scheduleFrequencyLabel(frequency: string) {
    switch (frequency) {
        case 'daily':
            return 'dnevno';
        case 'weekly':
            return 'tjedno';
        case 'biweekly':
            return 'svaka dva tjedna';
        case 'monthly':
            return 'mjesečno';
        default:
            return frequency;
    }
}

function configString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;
}

function configNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scheduleDaysText(config: AutomationGraph['nodes'][number]['config']) {
    const days: string[] = [];
    const dayOfWeek = configString(config.dayOfWeek);
    const daysOfWeek = config.daysOfWeek;

    if (dayOfWeek) {
        days.push(dayOfWeek);
    }
    if (Array.isArray(daysOfWeek)) {
        for (const item of daysOfWeek) {
            if (typeof item === 'string' && item.trim().length > 0) {
                days.push(item.trim());
            }
        }
    }

    const uniqueDays = [...new Set(days)];
    return uniqueDays.length > 0
        ? uniqueDays.map((day) => weekDayLabels[day] ?? day).join(', ')
        : '?';
}

function scheduleTriggerSummary(
    trigger: AutomationGraph['nodes'][number],
    moduleTitle: string,
) {
    const timeZone = configString(trigger.config.timeZone) ?? 'Europe/Zagreb';
    const frequency =
        trigger.moduleKey === automationModuleKeys.triggerScheduleMonthly
            ? 'monthly'
            : configString(trigger.config.frequency);

    if (!frequency) {
        return `${moduleTitle}: raspored nije konfiguriran (${timeZone})`;
    }

    if (frequency === 'daily') {
        return `${moduleTitle}: svaki dan (${timeZone})`;
    }

    if (frequency === 'weekly') {
        return `${moduleTitle}: ${scheduleFrequencyLabel(
            frequency,
        )}, ${scheduleDaysText(trigger.config)} (${timeZone})`;
    }

    if (frequency === 'biweekly') {
        const anchorDate = configString(trigger.config.anchorDate) ?? '?';
        return `${moduleTitle}: ${scheduleFrequencyLabel(
            frequency,
        )}, ${scheduleDaysText(trigger.config)}, od ${anchorDate} (${timeZone})`;
    }

    if (frequency === 'monthly') {
        const dayOfMonth = configNumber(trigger.config.dayOfMonth);
        const dayText = dayOfMonth ? dayOfMonth.toString() : '?';
        return `${moduleTitle}: dan ${dayText} (${timeZone})`;
    }

    return `${moduleTitle}: ${scheduleFrequencyLabel(frequency)} (${timeZone})`;
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
    if (
        trigger.moduleKey === automationModuleKeys.triggerSchedule ||
        trigger.moduleKey === automationModuleKeys.triggerScheduleMonthly
    ) {
        return scheduleTriggerSummary(trigger, moduleTitle);
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
