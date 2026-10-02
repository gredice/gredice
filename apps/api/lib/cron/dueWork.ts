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
    if (
        !options.force &&
        options.enabled !== false &&
        signal &&
        !recoveryDue &&
        (signal.dueAt === null || signal.dueAt > now.getTime())
    ) {
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
                if (signal)
                    await deps.acknowledge(
                        job,
                        signal.generation,
                        nextDueAt,
                        now,
                    );
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
    const response = await run();
    const body: unknown = response.ok ? await response.clone().json() : null;
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
            const nextDueAt =
                options.enabled === false
                    ? null
                    : await deps.nextDueAt(job, deps.now());
            await deps.acknowledge(
                job,
                signal.generation,
                nextDueAt,
                deps.now(),
            );
        } catch (error) {
            // Keep the original due hint on any projection/ack failure. CAS
            // also leaves concurrent enqueues intact for the next minute.
            warn(job, error);
        }
    }
    return response;
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
