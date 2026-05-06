#!/usr/bin/env node

import { spawn } from 'node:child_process';
import os from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAppByPackagePath } from './app-registry.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const commandName = process.argv[2];
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
                args: ['dev', '-p', String(app.devPort), '--no-open'],
            };
        }

        throw new Error(`Unsupported storybook app command: ${commandName}`);
    }

    if (commandName === 'dev') {
        return {
            command: 'next',
            args: ['dev', '-p', String(app.devPort)],
        };
    }

    if (commandName === 'start') {
        return {
            command: 'next',
            args: ['start', '-p', String(app.startPort)],
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

function signalExitCode(signal) {
    const signalNumber = signalNumbers?.[signal];
    if (typeof signalNumber === 'number') {
        return 128 + signalNumber;
    }

    return 1;
}

try {
    const appCommand = commandForApp();
    const spawnOptions = getSpawnOptions(appCommand.command, appCommand.args);
    const child = spawn(spawnOptions.command, spawnOptions.args, {
        stdio: 'inherit',
        env: process.env,
    });
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
    const forwardSignal = (signal) => {
        child.kill(signal);
    };

    for (const signal of signals) {
        process.on(signal, forwardSignal);
    }

    child.on('error', (error) => {
        for (const signal of signals) {
            process.off(signal, forwardSignal);
        }

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
        for (const signalName of signals) {
            process.off(signalName, forwardSignal);
        }

        if (signal) {
            process.exit(signalExitCode(signal));
            return;
        }

        process.exit(code ?? 0);
    });
} catch (error) {
    if (error?.message) {
        console.error(error.message);
    } else {
        console.error(error);
    }

    process.exit(1);
}
