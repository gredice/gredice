#!/usr/bin/env node

import { spawn } from 'node:child_process';
import os from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getAppByName,
    getAppByPackagePath,
    getAppDevPort,
    getAppStartPort,
    localAppHostnameUrl,
} from './app-registry.ts';
import {
    childProcessTreeOptions,
    shutdownSignals,
    signalExitCode,
    terminateChildProcessTree,
    waitForChildProcessTreeExit,
} from './process-tree.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const commandName = process.argv[2];
const forwardedArgs = process.argv.slice(3);
const currentPackagePath = relative(repoRoot, process.cwd()).replaceAll(
    '\\',
    '/',
);
const app = getAppByPackagePath(currentPackagePath);
const signalNumbers = os.constants?.signals ?? {};

if (!app) {
    console.error(
        `No Gredice app registry entry found for ${currentPackagePath}.`,
    );
    process.exit(1);
}

if (!commandName) {
    console.error('Missing app command. Use one of: dev, start, storybook.');
    process.exit(1);
}

function commandForApp() {
    if (app.name === 'storybook') {
        if (commandName === 'dev' || commandName === 'storybook') {
            return {
                command: 'storybook',
                args: [
                    'dev',
                    '-p',
                    String(getAppDevPort(app)),
                    '--no-open',
                    ...forwardedArgs,
                ],
            };
        }

        throw new Error(`Unsupported storybook app command: ${commandName}`);
    }

    if (commandName === 'dev') {
        return {
            command: 'next',
            args: ['dev', '-p', String(getAppDevPort(app)), ...forwardedArgs],
        };
    }

    if (commandName === 'start') {
        return {
            command: 'next',
            args: ['start', '-p', String(getAppStartPort(app)), ...forwardedArgs],
        };
    }

    throw new Error(`Unsupported app command: ${commandName}`);
}

function getSpawnOptions(command, args) {
    if (process.platform !== 'win32') {
        return { command, args };
    }

    return {
        command: process.env.ComSpec ?? 'cmd.exe',
        args: ['/d', '/s', '/c', [command, ...args].join(' ')],
    };
}

function applyLocalServiceEnv() {
    const apiApp = getAppByName('api');
    const apiPort =
        commandName === 'start' ? getAppStartPort(apiApp) : getAppDevPort(apiApp);
    process.env.GREDICE_API_HOST ??= localAppHostnameUrl(
        apiApp,
        'localhost',
        apiPort,
    );
}

try {
    applyLocalServiceEnv();
    const appCommand = commandForApp();
    const spawnOptions = getSpawnOptions(appCommand.command, appCommand.args);
    const child = spawn(spawnOptions.command, spawnOptions.args, {
        stdio: 'inherit',
        env: process.env,
        ...childProcessTreeOptions(),
    });
    let shutdownPromise = null;
    let shutdownError = null;
    let requestedSignal = null;
    const signalHandlers = shutdownSignals.map((signal) => {
        const handler = () => {
            requestedSignal ??= signal;
            shutdownPromise ??= terminateChildProcessTree(
                child,
                {
                    signal,
                    gracefulTimeoutMs: 8000,
                },
            ).catch((error) => {
                shutdownError = error;
                return false;
            });
        };
        process.on(signal, handler);
        return [signal, handler];
    });

    const removeSignalHandlers = () => {
        for (const [signal, handler] of signalHandlers) {
            process.off(signal, handler);
        }
    };

    child.on('error', (error) => {
        removeSignalHandlers();

        if (error?.code === 'ENOENT') {
            console.error(
                `Unable to find ${appCommand.command}. Ensure dependencies are installed.`,
            );
        } else if (error?.message) {
            console.error(error.message);
        } else {
            console.error(error);
        }

        process.exit(1);
    });

    child.on('exit', (code, signal) => {
        void (async () => {
            removeSignalHandlers();

            if (shutdownPromise) {
                await shutdownPromise;
                if (shutdownError) {
                    throw shutdownError;
                }
            } else if (signal) {
                await waitForChildProcessTreeExit(child, { timeoutMs: 2000 });
            }

            const exitSignal = signal ?? requestedSignal;
            if (exitSignal) {
                process.exit(signalExitCode(exitSignal, signalNumbers));
                return;
            }

            process.exit(code ?? 0);
        })().catch((error) => {
            if (error?.message) {
                console.error(error.message);
            } else {
                console.error(error);
            }

            process.exit(1);
        });
    });
} catch (error) {
    if (error?.message) {
        console.error(error.message);
    } else {
        console.error(error);
    }

    process.exit(1);
}
