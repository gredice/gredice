#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const caddyfilePath = resolve(scriptDir, 'dev', 'Caddyfile');
const containerName = 'gredice-dev-caddy';
const dockerImage = process.env.GREDICE_DEV_CADDY_IMAGE ?? 'caddy:2.9.1';
const shouldSkipProxy = parseEnvFlag(process.env.SKIP_DEV_PROXY ?? '');
const extraTurboArgs = process.argv.slice(2);
const signalNumbers = os.constants?.signals ?? {};

let proxyStarted = false;

function parseEnvFlag(value) {
    if (!value) {
        return false;
    }

    const normalized = value.toString().trim().toLowerCase();
    if (normalized === '' || normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
        return false;
    }

    return true;
}

function signalExitCode(signal) {
    const signalNumber = signalNumbers?.[signal];
    if (typeof signalNumber === 'number') {
        return 128 + signalNumber;
    }

    return 1;
}

async function spawnCommand(command, args, { capture = false, ignoreErrors = false, useShell = false } = {}) {
    return await new Promise((resolve, reject) => {
        let child;

        try {
            child = spawn(command, args, {
                stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
                env: process.env,
                shell: useShell,
            });
        } catch (error) {
            reject(error);
            return;
        }

        let stdout = '';
        let stderr = '';

        if (capture) {
            child.stdout?.on('data', (chunk) => {
                stdout += chunk.toString();
            });
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
        }

        child.on('error', (error) => {
            reject(error);
        });

        child.on('close', (code) => {
            if (code === 0 || ignoreErrors) {
                resolve({ code, stdout, stderr });
                return;
            }

            const commandString = `${command} ${args.join(' ')}`.trim();
            const outputMessage = (capture ? `${stderr}${stderr && stdout ? '\n' : ''}${stdout}` : '').trim();
            const error = new Error(outputMessage || `Command failed: ${commandString}`);
            error.code = code;
            error.stdout = stdout;
            error.stderr = stderr;
            reject(error);
        });
    });
}

async function runCommand(command, args, options = {}) {
    const { capture = false, ignoreErrors = false } = options;
    const runOptions = { capture, ignoreErrors, useShell: options.useShell === true };

    try {
        return await spawnCommand(command, args, runOptions);
    } catch (error) {
        if (error?.code === 'EINVAL' && process.platform === 'win32' && !runOptions.useShell) {
            return await runCommand(command, args, { ...options, useShell: true });
        }

        if (ignoreErrors) {
            return { code: null, stdout: '', stderr: '', error };
        }

        throw error;
    }
}

async function ensureCaddyfile() {
    await access(caddyfilePath);
}

async function startProxy() {
    await runCommand('docker', ['rm', '-f', containerName], { capture: true, ignoreErrors: true });

    const args = [
        'run',
        '--rm',
        '--name',
        containerName,
        '-d',
        '--add-host=host.docker.internal:host-gateway',
        '-p',
        '80:80',
        '-v',
        `${caddyfilePath}:/etc/caddy/Caddyfile:ro`,
        dockerImage,
    ];

    const { stdout } = await runCommand('docker', args, { capture: true });
    const containerId = stdout.trim();

    console.log(`Caddy dev proxy started${containerId ? ` (${containerId.slice(0, 12)})` : ''}.`);
    proxyStarted = true;
}

async function stopProxy() {
    if (!proxyStarted) {
        return;
    }

    const result = await runCommand('docker', ['stop', containerName], { capture: true, ignoreErrors: true });
    if (result.code === 0) {
        console.log('Caddy dev proxy stopped.');
    }
}

function getTurboCommand() {
    return process.platform === 'win32' ? 'turbo.cmd' : 'turbo';
}

async function runTurboDev() {
    return await new Promise((resolve, reject) => {
        const turboCommand = getTurboCommand();
        const turboProcess = spawn(turboCommand, ['dev', ...extraTurboArgs], {
            stdio: 'inherit',
            env: process.env,
        });

        const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
        const forwardSignal = (signal) => {
            turboProcess.kill(signal);
        };

        for (const signal of signals) {
            process.on(signal, forwardSignal);
        }

        turboProcess.on('error', (error) => {
            for (const signal of signals) {
                process.off(signal, forwardSignal);
            }

            reject(error);
        });

        turboProcess.on('exit', (code, signal) => {
            for (const signal of signals) {
                process.off(signal, forwardSignal);
            }

            if (signal) {
                resolve(signalExitCode(signal));
                return;
            }

            resolve(code ?? 0);
        });
    });
}

async function main() {
    if (shouldSkipProxy) {
        console.log('SKIP_DEV_PROXY is set. Starting Turborepo without the local Caddy proxy.');
    } else {
        try {
            await ensureCaddyfile();
        } catch {
            console.error(`Missing Caddyfile for the dev proxy at ${caddyfilePath}.`);
            console.error('Ensure the repository is up to date and try again.');
            return 1;
        }

        try {
            await startProxy();
            console.log('Apps will be available on the *.gredice.local subdomains once Turbo finishes booting.');
            console.log('Ensure that your hosts file maps these domains to 127.0.0.1.');
        } catch (error) {
            if (error?.code === 'ENOENT') {
                console.error('Docker is required to start the local dev proxy but it was not found in PATH.');
                console.error('Install Docker (or start Docker Desktop) and try again.');
                return 1;
            }

            console.error('Failed to start the Caddy dev proxy. Is the Docker daemon running?');
            if (error?.stderr) {
                console.error(error.stderr.trim());
            } else if (error?.message) {
                console.error(error.message);
            }

            return typeof error?.code === 'number' ? error.code : 1;
        }
    }

    try {
        return await runTurboDev();
    } catch (error) {
        if (error?.code === 'ENOENT') {
            console.error('Unable to find the Turborepo executable.');
            console.error('Ensure dependencies are installed and pnpm is available.');
            return 1;
        }

        if (error?.message) {
            console.error(error.message);
        } else {
            console.error(error);
        }

        return typeof error?.code === 'number' ? error.code : 1;
    }
}

let exitCode = 0;

main()
    .then((code) => {
        exitCode = code ?? 0;
    })
    .catch((error) => {
        if (error?.message) {
            console.error(error.message);
        } else {
            console.error(error);
        }
        exitCode = typeof error?.code === 'number' ? error.code : 1;
    })
    .finally(async () => {
        try {
            await stopProxy();
        } catch (error) {
            if (error?.message) {
                console.error(error.message);
            } else if (error) {
                console.error(error);
            }
        }

        process.exit(exitCode);
    });
