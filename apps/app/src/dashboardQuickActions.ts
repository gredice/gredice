import type { DashboardQuickActionConfigItem } from '@gredice/storage';
import { KnownPages } from './KnownPages';

export type DashboardQuickActionOption = {
    id: string;
    label: string;
    href: string;
    description: string;
};

type DashboardEntityTypeOption = {
    name: string;
    label: string;
};

const DASHBOARD_BUILTIN_QUICK_ACTIONS = [
    {
        key: 'schedule',
        label: 'Raspored',
        href: KnownPages.Schedule,
        description: 'Otvara raspored radnji i planiranja.',
    },
    {
        key: 'raised-beds',
        label: 'Gredice',
        href: KnownPages.RaisedBeds,
        description: 'Pregled i upravljanje svim gredicama.',
    },
    {
        key: 'operations',
        label: 'Radnje',
        href: KnownPages.Operations,
        description: 'Brzi pristup listi radnji.',
    },
    {
        key: 'delivery-requests',
        label: 'Zahtjevi za dostavu',
        href: KnownPages.DeliveryRequests,
        description: 'Pregled zahtjeva za dostavu.',
    },
    {
        key: 'transactions',
        label: 'Transakcije',
        href: KnownPages.Transactions,
        description: 'Pregled nedavnih transakcija.',
    },
] as const;

type DashboardBuiltinQuickActionKey =
    (typeof DASHBOARD_BUILTIN_QUICK_ACTIONS)[number]['key'];

function isBuiltinQuickActionKey(
    value: string,
): value is DashboardBuiltinQuickActionKey {
    return DASHBOARD_BUILTIN_QUICK_ACTIONS.some((item) => item.key === value);
}

export function encodeBuiltinQuickActionId(
    key: DashboardBuiltinQuickActionKey,
): string {
    return `builtin:${key}`;
}

export function encodeEntityQuickActionId(entityTypeName: string): string {
    return `entity:${entityTypeName}`;
}

export function parseQuickActionId(
    value: string,
): DashboardQuickActionConfigItem | null {
    if (value.startsWith('builtin:')) {
        const builtinKey = value.slice('builtin:'.length);
        if (!isBuiltinQuickActionKey(builtinKey)) {
            return null;
        }

        return {
            type: 'builtin',
            value: builtinKey,
        };
    }

    if (value.startsWith('entity:')) {
        const entityTypeName = value.slice('entity:'.length).trim();
        if (!entityTypeName) {
            return null;
        }

        return {
            type: 'entity',
            value: entityTypeName,
        };
    }

    return null;
}

export function buildDashboardQuickActionOptions(
    entityTypes: DashboardEntityTypeOption[],
): DashboardQuickActionOption[] {
    const builtinOptions: DashboardQuickActionOption[] =
        DASHBOARD_BUILTIN_QUICK_ACTIONS.map((item) => ({
            id: encodeBuiltinQuickActionId(item.key),
            label: item.label,
            href: item.href,
            description: item.description,
        }));

    const entityOptions: DashboardQuickActionOption[] = entityTypes.map(
        (entityType) => ({
            id: encodeEntityQuickActionId(entityType.name),
            label: entityType.label,
            href: KnownPages.DirectoryEntityType(entityType.name),
            description: `Otvara zapise tipa „${entityType.label}”.`,
        }),
    );

    return [...builtinOptions, ...entityOptions];
}

function parseQuickActionConfig(
    config: unknown,
): DashboardQuickActionConfigItem[] {
    if (typeof config !== 'object' || config === null) {
        return [];
    }

    if (!('actions' in config) || !Array.isArray(config.actions)) {
        return [];
    }

    const parsed: DashboardQuickActionConfigItem[] = [];

    for (const action of config.actions) {
        if (typeof action !== 'object' || action === null) {
            continue;
        }

        if (!('type' in action) || !('value' in action)) {
            continue;
        }

        if (
            (action.type === 'builtin' || action.type === 'entity') &&
            typeof action.value === 'string' &&
            action.value.length > 0
        ) {
            parsed.push({
                type: action.type,
                value: action.value,
            });
        }
    }

    return parsed;
}

function toQuickActionId(action: DashboardQuickActionConfigItem): string {
    if (action.type === 'builtin') {
        return `builtin:${action.value}`;
    }

    return `entity:${action.value}`;
}

export function getDashboardQuickActionsFromConfig(
    config: unknown,
    options: DashboardQuickActionOption[],
): DashboardQuickActionOption[] {
    const actions = parseQuickActionConfig(config);
    const optionsMap = new Map(options.map((option) => [option.id, option]));
    const selected: DashboardQuickActionOption[] = [];

    for (const action of actions) {
        const option = optionsMap.get(toQuickActionId(action));
        if (option) {
            selected.push(option);
        }
    }

    return selected;
}

export function getDefaultDashboardQuickActions(
    options: DashboardQuickActionOption[],
): DashboardQuickActionOption[] {
    const defaults = [
        encodeBuiltinQuickActionId('schedule'),
        encodeBuiltinQuickActionId('raised-beds'),
    ];

    const optionsMap = new Map(options.map((option) => [option.id, option]));

    return defaults
        .map((defaultAction) => optionsMap.get(defaultAction))
        .filter((option): option is DashboardQuickActionOption =>
            Boolean(option),
        );
}

export function getQuickActionIdsFromConfig(config: unknown): string[] {
    return parseQuickActionConfig(config).map((action) =>
        toQuickActionId(action),
    );
}
