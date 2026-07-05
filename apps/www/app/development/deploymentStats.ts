import 'server-only';

const GREDICE_VERCEL_TEAM_ID = 'team_QBex7AXLs3YNeyYGdMEPim4S';
const VERCEL_API_BASE_URL = 'https://api.vercel.com/v7/deployments';
const VERCEL_PAGE_LIMIT = 100;
const LIVE_WINDOW_DAYS = 30;
const MAX_PAGES_PER_PROJECT = 25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

export type DeploymentStatsTotals = {
    all: number;
    production: number;
    preview: number;
    readyProduction: number;
    erroredProduction: number;
    canceledProduction: number;
    productionAverage: number;
};

export type DeploymentDayStats = {
    date: string;
    all: number;
    production: number;
    readyProduction: number;
};

export type DeploymentStatsSnapshot =
    | {
          status: 'ready';
          title: string;
          description: string;
          totals: DeploymentStatsTotals;
          days: number;
          updatedAt: string | null;
          dayRows: DeploymentDayStats[];
      }
    | {
          status: 'unavailable';
          title: string;
          description: string;
          reason: string;
      };

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

export const may2026DeploymentStats: DeploymentStatsSnapshot = {
    status: 'ready',
    title: 'Svibanj 2026',
    description:
        'Zaključeni pregled svih Vercel deployment zapisa u svibnju 2026.',
    days: 31,
    updatedAt: null,
    totals: {
        all: 6518,
        production: 2064,
        preview: 4454,
        readyProduction: 1899,
        erroredProduction: 41,
        canceledProduction: 124,
        productionAverage: 66.58,
    },
    dayRows: [
        { date: '2026-05-01', all: 97, production: 26, readyProduction: 26 },
        { date: '2026-05-02', all: 38, production: 23, readyProduction: 21 },
        { date: '2026-05-03', all: 10, production: 0, readyProduction: 0 },
        { date: '2026-05-04', all: 287, production: 77, readyProduction: 64 },
        { date: '2026-05-05', all: 135, production: 39, readyProduction: 39 },
        { date: '2026-05-06', all: 120, production: 41, readyProduction: 41 },
        { date: '2026-05-07', all: 415, production: 113, readyProduction: 113 },
        { date: '2026-05-08', all: 278, production: 78, readyProduction: 78 },
        { date: '2026-05-09', all: 400, production: 103, readyProduction: 102 },
        { date: '2026-05-10', all: 29, production: 0, readyProduction: 0 },
        { date: '2026-05-11', all: 157, production: 53, readyProduction: 51 },
        { date: '2026-05-12', all: 237, production: 53, readyProduction: 46 },
        { date: '2026-05-13', all: 314, production: 87, readyProduction: 87 },
        { date: '2026-05-14', all: 383, production: 119, readyProduction: 119 },
        { date: '2026-05-15', all: 210, production: 66, readyProduction: 66 },
        { date: '2026-05-16', all: 84, production: 30, readyProduction: 28 },
        { date: '2026-05-17', all: 280, production: 81, readyProduction: 80 },
        { date: '2026-05-18', all: 61, production: 31, readyProduction: 31 },
        { date: '2026-05-19', all: 117, production: 32, readyProduction: 32 },
        { date: '2026-05-20', all: 372, production: 101, readyProduction: 101 },
        { date: '2026-05-21', all: 51, production: 22, readyProduction: 22 },
        { date: '2026-05-22', all: 49, production: 14, readyProduction: 14 },
        { date: '2026-05-23', all: 76, production: 29, readyProduction: 29 },
        { date: '2026-05-24', all: 212, production: 70, readyProduction: 70 },
        { date: '2026-05-25', all: 479, production: 167, readyProduction: 167 },
        { date: '2026-05-26', all: 152, production: 57, readyProduction: 57 },
        { date: '2026-05-27', all: 279, production: 100, readyProduction: 100 },
        { date: '2026-05-28', all: 309, production: 121, readyProduction: 121 },
        { date: '2026-05-29', all: 47, production: 0, readyProduction: 0 },
        { date: '2026-05-30', all: 636, production: 241, readyProduction: 132 },
        { date: '2026-05-31', all: 204, production: 90, readyProduction: 62 },
    ],
};

export async function getLiveDeploymentStats(): Promise<DeploymentStatsSnapshot> {
    const token = (
        process.env.GREDICE_VERCEL_TOKEN ??
        process.env.VERCEL_TOKEN ??
        ''
    ).trim();

    if (!token) {
        return {
            status: 'unavailable',
            title: 'Uživo',
            description: `Zadnjih ${LIVE_WINDOW_DAYS} dana`,
            reason: 'Nedostaje poslužiteljski Vercel token za dohvat deployment statistike.',
        };
    }

    const now = new Date();
    const until = now.getTime();
    const since = until - (LIVE_WINDOW_DAYS - 1) * MS_PER_DAY;
    const dayRows = createRollingDayRows(now, LIVE_WINDOW_DAYS);

    try {
        const deployments = await fetchAllProjectDeployments({
            token,
            since,
            until,
        });
        const stats = summarizeDeployments({
            deployments,
            dayRows,
            days: LIVE_WINDOW_DAYS,
            since,
            until,
        });

        return {
            status: 'ready',
            title: 'Uživo',
            description: `Zadnjih ${LIVE_WINDOW_DAYS} dana`,
            days: LIVE_WINDOW_DAYS,
            updatedAt: now.toISOString(),
            ...stats,
        };
    } catch (error) {
        console.error('Failed to fetch live Vercel deployment stats', error);
        return {
            status: 'unavailable',
            title: 'Uživo',
            description: `Zadnjih ${LIVE_WINDOW_DAYS} dana`,
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
                revalidate: 300,
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

    totals.productionAverage = roundToTwo(totals.production / days);

    return {
        totals,
        dayRows,
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
        productionAverage: roundToTwo(0 / days),
    };
}

function createRollingDayRows(now: Date, days: number): DeploymentDayStats[] {
    return Array.from({ length: days }, (_, index) => {
        const date = new Date(now.getTime() - (days - index - 1) * MS_PER_DAY);
        return {
            date: dateKeyZagreb(date.getTime()),
            all: 0,
            production: 0,
            readyProduction: 0,
        };
    });
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

function roundToTwo(value: number) {
    return Math.round(value * 100) / 100;
}
