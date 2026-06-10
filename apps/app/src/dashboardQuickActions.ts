import type { DashboardQuickActionConfigItem } from '@gredice/storage';
import type { Route } from 'next';
import { KnownPages } from './KnownPages';

export type DashboardQuickActionOption = {
    id: string;
    label: string;
    href: Route;
    description: string;
    icon?: string | null;
};

export type DashboardQuickActionBadgeCounts = {
    pendingAchievementsCount: number;
    pendingApprovalTasksCount: number;
};

type DashboardEntityTypeOption = {
    name: string;
    label: string;
    icon?: string | null;
};

type DashboardBuiltinQuickAction = {
    key: string;
    label: string;
    href: Route;
    description?: string;
};

const DASHBOARD_BUILTIN_QUICK_ACTIONS = [
    {
        key: 'directories',
        label: 'Zapisi',
        href: KnownPages.Directories,
    },
    {
        key: 'directories-activity',
        label: 'Aktivnosti',
        href: KnownPages.DirectoriesActivity,
    },
    {
        key: 'cms-pages',
        label: 'Stranice',
        href: KnownPages.CmsPages,
    },
    {
        key: 'accounts',
        label: 'Korisnički računi',
        href: KnownPages.Accounts,
    },
    {
        key: 'achievements',
        label: 'Postignuća',
        href: KnownPages.Achievements,
    },
    {
        key: 'shopping-carts',
        label: 'Košarice',
        href: KnownPages.ShoppingCarts,
    },
    {
        key: 'invoices',
        label: 'Ponude',
        href: KnownPages.Invoices,
    },
    {
        key: 'transactions',
        label: 'Transakcije',
        href: KnownPages.Transactions,
        description: 'Pregled nedavnih transakcija.',
    },
    {
        key: 'sunflowers',
        label: 'Suncokreti',
        href: KnownPages.Sunflowers,
    },
    {
        key: 'receipts',
        label: 'Fiskalni računi',
        href: KnownPages.Receipts,
    },
    {
        key: 'outlet',
        label: 'Outlet',
        href: KnownPages.Outlet,
        description: 'Upravljanje outlet ponudama i rezervacijama.',
    },
    {
        key: 'users',
        label: 'Korisnici',
        href: KnownPages.Users,
    },
    {
        key: 'farms',
        label: 'Farme',
        href: KnownPages.Farms,
    },
    {
        key: 'weather',
        label: 'Vrijeme',
        href: KnownPages.Weather,
    },
    {
        key: 'gardens',
        label: 'Vrtovi',
        href: KnownPages.Gardens,
    },
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
        key: 'greenhouse',
        label: 'Staklenik',
        href: KnownPages.Greenhouse,
        description: 'Pregled biljaka koje su trenutno u stakleniku.',
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
        key: 'farmer-payouts',
        label: 'Isplate farmera',
        href: KnownPages.FarmerPayouts,
    },
    {
        key: 'farmer-prices',
        label: 'Cijene radnji',
        href: KnownPages.FarmerPrices,
    },
    {
        key: 'inventory',
        label: 'Zalihe',
        href: KnownPages.Inventory,
    },
    {
        key: 'occasions',
        label: 'Prigode',
        href: KnownPages.Occasions,
    },
    {
        key: 'approvals',
        label: 'Odobrenja',
        href: KnownPages.Approvals,
    },
    {
        key: 'automations',
        label: 'Automatizacije',
        href: KnownPages.Automations,
    },
    {
        key: 'sowing-statistics',
        label: 'Statistika sijanja',
        href: KnownPages.SowingStatistics,
    },
    {
        key: 'delivery-slots',
        label: 'Dostava - Slotovi',
        href: KnownPages.DeliverySlots,
    },
    {
        key: 'communication-inbox',
        label: 'Sandučić',
        href: KnownPages.CommunicationInbox,
    },
    {
        key: 'communication-emails',
        label: 'Poslani emailovi',
        href: KnownPages.CommunicationEmails,
    },
    {
        key: 'communication-slack',
        label: 'Slack',
        href: KnownPages.CommunicationSlack,
    },
    {
        key: 'notifications',
        label: 'Obavijesti',
        href: KnownPages.Notifications,
    },
    {
        key: 'feedback',
        label: 'Povratne informacije',
        href: KnownPages.Feedback,
    },
    {
        key: 'sensors',
        label: 'Senzori',
        href: KnownPages.Sensors,
    },
    {
        key: 'cache',
        label: 'Cache',
        href: KnownPages.Cache,
    },
    {
        key: 'ai-analytics',
        label: 'AI analitika',
        href: KnownPages.AiAnalytics,
    },
    {
        key: 'settings',
        label: 'Postavke',
        href: KnownPages.Settings,
    },
    {
        key: 'social-publishing',
        label: 'Društvene objave',
        href: KnownPages.SocialPublishing,
    },
] as const satisfies readonly DashboardBuiltinQuickAction[];

type DashboardBuiltinQuickActionKey =
    (typeof DASHBOARD_BUILTIN_QUICK_ACTIONS)[number]['key'];

function isBuiltinQuickActionKey(
    value: string,
): value is DashboardBuiltinQuickActionKey {
    return DASHBOARD_BUILTIN_QUICK_ACTIONS.some((item) => item.key === value);
}

function getBuiltinQuickActionDescription(
    item: DashboardBuiltinQuickAction,
): string {
    return item.description ?? `Otvara stranicu „${item.label}”.`;
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
            description: getBuiltinQuickActionDescription(item),
        }));

    const entityOptions: DashboardQuickActionOption[] = entityTypes.map(
        (entityType) => ({
            id: encodeEntityQuickActionId(entityType.name),
            label: entityType.label,
            href: KnownPages.DirectoryEntityType(entityType.name),
            description: `Otvara zapise tipa „${entityType.label}”.`,
            icon: entityType.icon,
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

export function getDashboardQuickActionBadge(
    quickAction: Pick<DashboardQuickActionOption, 'href'>,
    counts: DashboardQuickActionBadgeCounts,
): number | undefined {
    switch (quickAction.href) {
        case KnownPages.Achievements:
            return counts.pendingAchievementsCount;
        case KnownPages.Approvals:
            return counts.pendingApprovalTasksCount;
        default:
            return undefined;
    }
}
