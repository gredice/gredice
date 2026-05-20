import { spawnSync } from 'node:child_process';

export const shutdownSignals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

export const supportsProcessGroups = process.platform !== 'win32';

export function childProcessTreeOptions() {
    return supportsProcessGroups ? { detached: true } : {};
}

export function signalExitCode(signal, signalNumbers) {
    const signalNumber = signalNumbers?.[signal];
    if (typeof signalNumber === 'number') {
        return 128 + signalNumber;
    }

    return 1;
}

function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}

function isMissingProcessError(error) {
    return error?.code === 'ESRCH';
}

export function processStatesIncludeLiveProcess(processStates) {
    const states = processStates
        .split('\n')
        .map((state) => state.trim())
        .filter(Boolean);

    return states.some((state) => !state.startsWith('Z'));
}

export function signalChildProcessTree(child, signal) {
    if (!child?.pid) {
        return false;
    }

    try {
        if (supportsProcessGroups) {
            process.kill(-child.pid, signal);
            return true;
        }

        return child.kill(signal);
    } catch (error) {
        if (isMissingProcessError(error)) {
            return false;
        }

        throw error;
    }
}

function forceKillChildProcessTree(child) {
    if (!child?.pid) {
        return false;
    }

    if (process.platform === 'win32') {
        const result = spawnSync(
            'taskkill',
            ['/pid', String(child.pid), '/t', '/f'],
            { stdio: 'ignore' },
        );
        return result.status === 0;
    }

    return signalChildProcessTree(child, 'SIGKILL');
}

function processGroupHasLiveProcesses(processGroupId) {
    const result = spawnSync('ps', ['-o', 'state=', '-g', String(processGroupId)], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });

    if (result.error || result.status !== 0) {
        return true;
    }

    return processStatesIncludeLiveProcess(result.stdout);
}

function isChildProcessTreeRunning(child) {
    if (!child?.pid) {
        return false;
    }

    if (!supportsProcessGroups) {
        return child.exitCode === null && child.signalCode === null;
    }

    try {
        process.kill(-child.pid, 0);
    } catch (error) {
        if (isMissingProcessError(error)) {
            return false;
        }

        throw error;
    }

    return processGroupHasLiveProcesses(child.pid);
}

export async function waitForChildProcessTreeExit(
    child,
    { timeoutMs = 5000, intervalMs = 100 } = {},
) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
        if (!isChildProcessTreeRunning(child)) {
            return true;
        }

        await delay(intervalMs);
    }

    return !isChildProcessTreeRunning(child);
}

export async function terminateChildProcessTree(
    child,
    {
        signal = 'SIGTERM',
        gracefulTimeoutMs = 8000,
        terminateTimeoutMs = 2000,
    } = {},
) {
    const signaled = signalChildProcessTree(child, signal);
    if (!signaled) {
        return true;
    }

    if (
        await waitForChildProcessTreeExit(child, {
            timeoutMs: gracefulTimeoutMs,
        })
    ) {
        return true;
    }

    if (signal !== 'SIGTERM') {
        signalChildProcessTree(child, 'SIGTERM');
        if (
            await waitForChildProcessTreeExit(child, {
                timeoutMs: terminateTimeoutMs,
            })
        ) {
            return true;
        }
    }

    forceKillChildProcessTree(child);
    return await waitForChildProcessTreeExit(child, { timeoutMs: 1000 });
}
