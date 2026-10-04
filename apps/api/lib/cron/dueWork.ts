import {
    acknowledgeDueWork,
    type DueWorkJob,
    getNextDueWorkAt,
    readDueWorkSignal,
} from '@gredice/storage';

const noStoreHeaders = { 'Cache-Control': 'private, no-store' };

type DueWorkDependencies = {
    acknowledge: typeof acknowledgeDueWork;
    nextDueAt: typeof getNextDueWorkAt;
    read: typeof readDueWorkSignal;
    now: () => Date;
};

const dependencies: DueWorkDependencies = {
    acknowledge: acknowledgeDueWork,
    nextDueAt: getNextDueWorkAt,
    read: readDueWorkSignal,
    now: () => new Date(),
};

type DueWorkAttribution = {
    job: DueWorkJob;
    reason:
        | 'idle-signal'
        | 'recovery-preflight'
        | 'forced'
        | 'disabled'
        | 'redis-unavailable'
        | 'hourly-recovery'
        | 'due-signal';
    signalAvailable: boolean;
    recoveryDue: boolean;
    workerStarted: boolean;
    signalLatenessMs: number | null;
    status: number | null;
    success: boolean | null;
    thrownPhase: 'worker' | 'response' | null;
    acknowledgement:
        | 'not-attempted'
        | 'missing-signal'
        | 'acknowledged'
        | 'raced'
        | 'error';
};

function recordDueWork(record: DueWorkAttribution, startedAt: number) {
    try {
        console.info(
            'due-work-dispatch',
            JSON.stringify({
                ...record,
                durationMs: Math.max(
                    0,
                    Math.round(performance.now() - startedAt),
                ),
            }),
        );
    } catch {
        // Optional attribution must not change worker or retry behavior.
    }
}

function warn(job: DueWorkJob, error: unknown) {
    console.warn('Due-work dispatcher recovery required', {
        job,
        errorName: error instanceof Error ? error.name : 'Unknown',
    });
}

export async function runDueWork(
    job: DueWorkJob,
    run: () => Promise<Response>,
    options: {
        force?: boolean;
        enabled?: boolean;
        recoveryPreflight?: boolean;
    } = {},
    deps = dependencies,
) {
    const attributionEnabled = process.env.DUE_WORK_ATTRIBUTION === '1';
    const startedAt = attributionEnabled ? performance.now() : 0;
    const attribution: DueWorkAttribution = {
        job,
        reason: 'redis-unavailable',
        signalAvailable: false,
        recoveryDue: true,
        workerStarted: false,
        signalLatenessMs: null,
        status: null,
        success: null,
        thrownPhase: null,
        acknowledgement: 'not-attempted',
    };
    try {
        const now = deps.now();
        let signal: Awaited<ReturnType<typeof readDueWorkSignal>> = null;
        try {
            signal = await deps.read(job);
        } catch (error) {
            warn(job, error);
        }
        // Align fallback scans for all jobs to one UTC hour, allowing PostgreSQL
        // to sleep between active work and a bounded common recovery window.
        const recoveryDue =
            !signal ||
            Math.floor(signal.checkedAt / 3_600_000) <
                Math.floor(now.getTime() / 3_600_000);
        attribution.signalAvailable = signal !== null;
        attribution.recoveryDue = recoveryDue;
        if (!signal) attribution.acknowledgement = 'missing-signal';
        attribution.reason = options.force
            ? 'forced'
            : options.enabled === false
              ? 'disabled'
              : !signal
                ? 'redis-unavailable'
                : recoveryDue
                  ? 'hourly-recovery'
                  : 'due-signal';
        if (
            !options.force &&
            options.enabled !== false &&
            signal &&
            !recoveryDue &&
            (signal.dueAt === null || signal.dueAt > now.getTime())
        ) {
            attribution.reason = 'idle-signal';
            attribution.status = 200;
            attribution.success = true;
            return Response.json(
                { success: true, skipped: true, job },
                { headers: noStoreHeaders },
            );
        }

        if (
            options.recoveryPreflight &&
            recoveryDue &&
            !options.force &&
            options.enabled !== false
        ) {
            try {
                const nextDueAt = await deps.nextDueAt(job, now);
                if (!nextDueAt || nextDueAt.getTime() > now.getTime()) {
                    attribution.acknowledgement = 'missing-signal';
                    if (signal) {
                        attribution.acknowledgement = 'error';
                        const acknowledged = await deps.acknowledge(
                            job,
                            signal.generation,
                            nextDueAt,
                            now,
                        );
                        attribution.acknowledgement = acknowledged
                            ? 'acknowledged'
                            : 'raced';
                    }
                    attribution.reason = 'recovery-preflight';
                    attribution.status = 200;
                    attribution.success = true;
                    return Response.json(
                        { success: true, skipped: true, job },
                        { headers: noStoreHeaders },
                    );
                }
            } catch (error) {
                // A broken projection must not hide actionable durable work.
                warn(job, error);
            }
        }

        // Disabled workers retain their existing response/rollout policy and never
        // open PostgreSQL solely to calculate a hint. Recovery notices re-enabling.
        attribution.workerStarted = true;
        if (
            attributionEnabled &&
            options.enabled !== false &&
            signal &&
            signal.dueAt !== null
        ) {
            attribution.signalLatenessMs = Math.max(
                0,
                deps.now().getTime() - signal.dueAt,
            );
        }
        let response: Response;
        try {
            response = await run();
        } catch (error) {
            attribution.thrownPhase = 'worker';
            throw error;
        }
        attribution.status = response.status;
        let body: unknown;
        try {
            body = response.ok ? await response.clone().json() : null;
        } catch (error) {
            attribution.thrownPhase = 'response';
            throw error;
        }
        attribution.success =
            response.ok &&
            !(
                typeof body === 'object' &&
                body !== null &&
                'success' in body &&
                body.success === false
            );
        if (
            !response.ok ||
            (typeof body === 'object' &&
                body !== null &&
                'success' in body &&
                body.success === false)
        )
            return response;

        // Missing/broken Redis fails open. A worker still processes durable work;
        // don't report a cost reduction while signals cannot be acknowledged.
        if (signal) {
            try {
                attribution.acknowledgement = 'error';
                const nextDueAt =
                    options.enabled === false
                        ? null
                        : await deps.nextDueAt(job, deps.now());
                const acknowledged = await deps.acknowledge(
                    job,
                    signal.generation,
                    nextDueAt,
                    deps.now(),
                );
                attribution.acknowledgement = acknowledged
                    ? 'acknowledged'
                    : 'raced';
            } catch (error) {
                // Keep the original due hint on any projection/ack failure. CAS
                // also leaves concurrent enqueues intact for the next minute.
                warn(job, error);
            }
        } else {
            attribution.acknowledgement = 'missing-signal';
        }
        return response;
    } finally {
        if (attributionEnabled) recordDueWork(attribution, startedAt);
    }
}

export async function handleDueWorkCron(
    request: Request,
    job: DueWorkJob,
    run: () => Promise<Response>,
    options: {
        force?: boolean;
        enabled?: boolean;
        recoveryPreflight?: boolean;
    } = {},
    deps = dependencies,
) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
        return new Response('Unauthorized', {
            status: 401,
            headers: noStoreHeaders,
        });
    return runDueWork(job, run, options, deps);
}
