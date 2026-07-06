import 'server-only';

import {
    DEFAULT_DEPLOYMENT_STATS_PERIOD,
    type DeploymentDayStats,
    type DeploymentStatsPeriodSelection,
    type DeploymentStatsSnapshot,
    type DeploymentStatsTotals,
} from './deploymentStatsTypes';

const GREDICE_VERCEL_TEAM_ID = 'team_QBex7AXLs3YNeyYGdMEPim4S';
const VERCEL_API_BASE_URL = 'https://api.vercel.com/v7/deployments';
const VERCEL_PAGE_LIMIT = 100;
const LIVE_WINDOW_DAYS = 30;
const MAX_PAGES_PER_PROJECT = 25;
export const DEPLOYMENT_STATS_CACHE_SECONDS = 12 * 60 * 60;

type VercelProject = {
    name: string;
    id: string;
};

const GREDICE_VERCEL_PROJECTS: VercelProject[] = [
    { name: 'www', id: 'prj_8uJc85iiKpqb6IXNAB9NzlK6cgs9' },
    { name: 'farm', id: 'prj_fbD4Gez7mfI7brm5QgzEjFY8idX4' },
    { name: 'news', id: 'prj_3nFddYf9mzGPoqBbCsTwgq7btSrF' },
    { name: 'storybook', id: 'prj_Z9VX45uRUVslMgiBOV1tJFEkFuY2' },
    { name: 'app', id: 'prj_U6c1DSeg2q9qgGKuB4xbHcDoGwLh' },
    { name: 'api', id: 'prj_QnFGF335wtB8QLW5Nte7xmNW5Qqe' },
    { name: 'status', id: 'prj_wpzMwZmu7SPA6pfUq4SoqVxyZl1M' },
    { name: 'garden', id: 'prj_tJ406gH1dAjl7J2VDZBTv0aBAOJF' },
];

type VercelDeployment = {
    id: string;
    created: number;
    target: string | null;
    state: string | null;
    readyState: string | null;
};

type VercelDeploymentsPage = {
    deployments: VercelDeployment[];
    next: number | null;
};

type DeploymentStatsRange = {
    period: DeploymentStatsPeriodSelection;
    title: string;
    description: string;
    days: number;
    since: number;
    until: number;
    dayRows: DeploymentDayStats[];
};

const monthLabelFormatter = new Intl.DateTimeFormat('hr-HR', {
    month: 'long',
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
});

export function getDeploymentStatsPeriodFromSearchParams(
    searchParams: URLSearchParams,
): DeploymentStatsPeriodSelection {
    const mode = searchParams.get('mode');

    if (mode === 'last-month') {
        return { mode };
    }

    if (mode === 'month') {
        const month = normalizeMonthValue(searchParams.get('month'));

        if (month) {
            return { mode, month };
        }
    }

    return DEFAULT_DEPLOYMENT_STATS_PERIOD;
}

export async function getDeploymentStats(
    period: DeploymentStatsPeriodSelection = DEFAULT_DEPLOYMENT_STATS_PERIOD,
): Promise<DeploymentStatsSnapshot> {
    const now = new Date();
    const range = createDeploymentStatsRange(period, now);
    const token = (
        process.env.GREDICE_VERCEL_TOKEN ??
        process.env.VERCEL_TOKEN ??
        ''
    ).trim();

    if (!token) {
        return {
            status: 'unavailable',
            period: range.period,
            title: range.title,
            description: range.description,
            reason: 'Deployment statistika trenutno nije dostupna.',
        };
    }

    try {
        const deployments = await fetchAllProjectDeployments({
            token,
            since: range.since,
            until: range.until,
        });
        const stats = summarizeDeployments({
            deployments,
            dayRows: range.dayRows,
            days: range.days,
            since: range.since,
            until: range.until,
        });

        return {
            status: 'ready',
            period: range.period,
            title: range.title,
            description: range.description,
            days: range.days,
            updatedAt: now.toISOString(),
            ...stats,
        };
    } catch (error) {
        console.error('Failed to fetch Vercel deployment stats', error);
        return {
            status: 'unavailable',
            period: range.period,
            title: range.title,
            description: range.description,
            reason: 'Vercel API trenutno nije vratio deployment statistiku.',
        };
    }
}

async function fetchAllProjectDeployments({
    token,
    since,
    until,
}: {
    token: string;
    since: number;
    until: number;
}) {
    const deployments = new Map<string, VercelDeployment>();

    await Promise.all(
        GREDICE_VERCEL_PROJECTS.map(async (project) => {
            const projectDeployments = await fetchProjectDeployments({
                project,
                token,
                since,
                until,
            });
            for (const deployment of projectDeployments) {
                deployments.set(deployment.id, deployment);
            }
        }),
    );

    return [...deployments.values()];
}

async function fetchProjectDeployments({
    project,
    token,
    since,
    until,
}: {
    project: VercelProject;
    token: string;
    since: number;
    until: number;
}) {
    const deployments: VercelDeployment[] = [];
    let pageUntil = until;

    for (let page = 0; page < MAX_PAGES_PER_PROJECT; page += 1) {
        const url = new URL(VERCEL_API_BASE_URL);
        url.searchParams.set('teamId', GREDICE_VERCEL_TEAM_ID);
        url.searchParams.set('projectId', project.id);
        url.searchParams.set('since', since.toString());
        url.searchParams.set('until', pageUntil.toString());
        url.searchParams.set('limit', VERCEL_PAGE_LIMIT.toString());

        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            next: {
                revalidate: DEPLOYMENT_STATS_CACHE_SECONDS,
            },
        });

        if (!response.ok) {
            throw new Error(
                `Vercel deployments request failed for ${project.name}: ${response.status}`,
            );
        }

        const payload = parseVercelDeploymentsPage(await response.json());
        deployments.push(...payload.deployments);

        if (
            payload.next === null ||
            payload.next <= since ||
            payload.next >= pageUntil
        ) {
            break;
        }

        pageUntil = payload.next;
    }

    return deployments;
}

function summarizeDeployments({
    deployments,
    dayRows,
    days,
    since,
    until,
}: {
    deployments: VercelDeployment[];
    dayRows: DeploymentDayStats[];
    days: number;
    since: number;
    until: number;
}) {
    const rowsByDate = new Map(dayRows.map((row) => [row.date, row]));
    const totals = createEmptyTotals(days);

    for (const deployment of deployments) {
        if (deployment.created < since || deployment.created >= until) {
            continue;
        }

        const day = rowsByDate.get(dateKeyZagreb(deployment.created));
        if (!day) {
            continue;
        }

        totals.all += 1;
        day.all += 1;

        if (deployment.target !== 'production') {
            totals.preview += 1;
            continue;
        }

        totals.production += 1;
        day.production += 1;

        const state = deployment.state ?? deployment.readyState;
        if (state === 'READY') {
            totals.readyProduction += 1;
            day.readyProduction += 1;
        } else if (state === 'ERROR' || state === 'BUILDING_ERROR') {
            totals.erroredProduction += 1;
        } else if (state === 'CANCELED') {
            totals.canceledProduction += 1;
        }
    }

    totals.productionAverage = roundToTwo(
        days > 0 ? totals.production / days : 0,
    );

    return {
        totals,
        dayRows,
    };
}

function createDeploymentStatsRange(
    period: DeploymentStatsPeriodSelection,
    now: Date,
): DeploymentStatsRange {
    if (period.mode === 'last-month') {
        return createLastMonthRange(now);
    }

    if (period.mode === 'month') {
        return createMonthRange(period.month, now);
    }

    return createRollingRange(now, LIVE_WINDOW_DAYS);
}

function createRollingRange(now: Date, days: number): DeploymentStatsRange {
    const until = now.getTime();
    const today = dateKeyZagreb(until);
    const dayRows = Array.from({ length: days }, (_, index) =>
        createEmptyDayRow(shiftDateKey(today, index - days + 1)),
    );
    const firstDay = dayRows[0]?.date ?? today;

    return {
        period: { mode: 'rolling-30-days' },
        title: 'Zadnjih 30 dana',
        description: 'Uključuje današnji dan i prethodnih 29 dana.',
        days,
        since: startOfZagrebDayMs(firstDay),
        until,
        dayRows,
    };
}

function createLastMonthRange(now: Date): DeploymentStatsRange {
    const month = previousMonthValue(now);
    const range = createCalendarMonthRange({
        description: 'Zadnji završeni kalendarski mjesec.',
        month,
        now,
        period: { mode: 'last-month' },
    });

    return range;
}

function createMonthRange(
    requestedMonth: string,
    now: Date,
): DeploymentStatsRange {
    const currentMonth = monthValueZagreb(now.getTime());
    const month = requestedMonth > currentMonth ? currentMonth : requestedMonth;

    return createCalendarMonthRange({
        description:
            month === currentMonth
                ? 'Odabrani mjesec do danas.'
                : 'Odabrani kalendarski mjesec.',
        month,
        now,
        period: { mode: 'month', month },
    });
}

function createCalendarMonthRange({
    description,
    month,
    now,
    period,
}: {
    description: string;
    month: string;
    now: Date;
    period: DeploymentStatsPeriodSelection;
}): DeploymentStatsRange {
    const startDateKey = `${month}-01`;
    const currentMonth = monthValueZagreb(now.getTime());
    const endDateKey =
        month === currentMonth
            ? shiftDateKey(dateKeyZagreb(now.getTime()), 1)
            : `${nextMonthValue(month)}-01`;
    const dayRows = createDayRows(startDateKey, endDateKey);
    const days = dayRows.length;
    const endBoundary = startOfZagrebDayMs(endDateKey);

    return {
        period,
        title: formatMonthTitle(month),
        description,
        days,
        since: startOfZagrebDayMs(startDateKey),
        until: Math.min(endBoundary, now.getTime()),
        dayRows,
    };
}

function createDayRows(startDateKey: string, endDateKey: string) {
    const dayRows: DeploymentDayStats[] = [];
    let date = startDateKey;

    while (date < endDateKey) {
        dayRows.push(createEmptyDayRow(date));
        date = shiftDateKey(date, 1);
    }

    return dayRows;
}

function createEmptyDayRow(date: string): DeploymentDayStats {
    return {
        date,
        all: 0,
        production: 0,
        readyProduction: 0,
    };
}

function createEmptyTotals(days: number): DeploymentStatsTotals {
    return {
        all: 0,
        production: 0,
        preview: 0,
        readyProduction: 0,
        erroredProduction: 0,
        canceledProduction: 0,
        productionAverage: roundToTwo(days > 0 ? 0 / days : 0),
    };
}

function parseVercelDeploymentsPage(value: unknown): VercelDeploymentsPage {
    if (!isRecord(value)) {
        return { deployments: [], next: null };
    }

    const deploymentsValue = value.deployments;
    const deployments = Array.isArray(deploymentsValue)
        ? deploymentsValue.flatMap((deployment) => {
              const parsed = parseVercelDeployment(deployment);
              return parsed ? [parsed] : [];
          })
        : [];

    const pagination = isRecord(value.pagination) ? value.pagination : null;
    const next = typeof pagination?.next === 'number' ? pagination.next : null;

    return {
        deployments,
        next,
    };
}

function parseVercelDeployment(value: unknown): VercelDeployment | null {
    if (!isRecord(value)) {
        return null;
    }

    const id =
        stringValue(value.uid) ??
        stringValue(value.id) ??
        stringValue(value.url);
    const created = numberValue(value.created) ?? numberValue(value.createdAt);

    if (!id || typeof created !== 'number') {
        return null;
    }

    return {
        id,
        created,
        target: nullableStringValue(value.target),
        state: nullableStringValue(value.state),
        readyState: nullableStringValue(value.readyState),
    };
}

function normalizeMonthValue(value: string | null) {
    if (!value) {
        return null;
    }

    const match = value.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
        return null;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year < 2020 || year > 2100 || month < 1 || month > 12) {
        return null;
    }

    return value;
}

function previousMonthValue(now: Date) {
    const currentMonth = monthValueZagreb(now.getTime());
    const [year = 0, month = 1] = currentMonth.split('-').map(Number);

    return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
}

function nextMonthValue(monthValue: string) {
    const [year = 0, month = 1] = monthValue.split('-').map(Number);

    return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

function formatMonthTitle(monthValue: string) {
    const [year = 0, month = 1] = monthValue.split('-').map(Number);
    const label = monthLabelFormatter.format(
        new Date(Date.UTC(year, month - 1, 15)),
    );
    const normalizedLabel = label.replace(/\.$/, '');

    return (
        normalizedLabel.charAt(0).toLocaleUpperCase('hr-HR') +
        normalizedLabel.slice(1)
    );
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function nullableStringValue(value: unknown): string | null {
    return value === null || typeof value === 'undefined'
        ? null
        : stringValue(value);
}

function numberValue(value: unknown): number | null {
    return typeof value === 'number' ? value : null;
}

function startOfZagrebDayMs(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const utcMidnight = Date.UTC(year, month - 1, day);
    const offset = zagrebOffsetMinutes(utcMidnight);
    const candidate = utcMidnight - offset * 60 * 1000;
    const candidateOffset = zagrebOffsetMinutes(candidate);

    return utcMidnight - candidateOffset * 60 * 1000;
}

function zagrebOffsetMinutes(ms: number) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Zagreb',
        timeZoneName: 'shortOffset',
    }).formatToParts(new Date(ms));
    const timeZoneName =
        parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = timeZoneName.match(
        /^GMT(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?$/,
    );

    if (!match?.groups) {
        return 0;
    }

    const sign = match.groups.sign === '-' ? -1 : 1;
    const hours = Number(match.groups.hours);
    const minutes = Number(match.groups.minutes ?? 0);

    return sign * (hours * 60 + minutes);
}

function dateKeyZagreb(ms: number) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Zagreb',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(ms));

    const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
    const month = parts.find((part) => part.type === 'month')?.value ?? '00';
    const day = parts.find((part) => part.type === 'day')?.value ?? '00';

    return `${year}-${month}-${day}`;
}

function monthValueZagreb(ms: number) {
    return dateKeyZagreb(ms).slice(0, 7);
}

function shiftDateKey(dateKey: string, dayOffset: number) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + dayOffset))
        .toISOString()
        .slice(0, 10);
}

function roundToTwo(value: number) {
    return Math.round(value * 100) / 100;
}
