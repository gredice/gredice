#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { access, appendFile, readFile } from 'node:fs/promises';
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
const requiredHosts = [
    'www.gredice.local',
    'vrt.gredice.local',
    'farm.gredice.local',
    'app.gredice.local',
    'api.gredice.local',
];
const requiredHostsLine = `127.0.0.1 ${requiredHosts.join(' ')}`;

let proxyStarted = false;

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getHostsFilePath() {
    if (process.platform === 'win32') {
        const systemRoot = process.env.SystemRoot ?? process.env.windir ?? 'C:\\Windows';
        return resolve(systemRoot, 'System32', 'drivers', 'etc', 'hosts');
    }

    return '/etc/hosts';
}

function isHostMappedToLocalhost(contents, host) {
    const escapedHost = escapeRegExp(host);
    const pattern = new RegExp(`^\\s*127\\.0\\.0\\.1\\s+.*\\b${escapedHost}\\b`, 'mi');
    return pattern.test(contents);
}

function createHostsPermissionError(hostsFilePath, cause) {
    const error = new Error(`Insufficient permissions to modify the hosts file at ${hostsFilePath}.`);
    error.code = 'HOSTS_PERMISSION_DENIED';
    error.hostsFilePath = hostsFilePath;
    error.cause = cause;
    return error;
}

function createHostsNotFoundError(hostsFilePath, cause) {
    const error = new Error(`Unable to find the hosts file at ${hostsFilePath}.`);
    error.code = 'HOSTS_FILE_NOT_FOUND';
    error.hostsFilePath = hostsFilePath;
    error.cause = cause;
    return error;
}

async function ensureHostsEntries() {
    const hostsFilePath = getHostsFilePath();
    if (!hostsFilePath) {
        console.warn('Unable to determine the hosts file path for this platform.');
        console.warn('Add the following entry manually to use the local dev proxy:');
        console.warn(requiredHostsLine);
        return;
    }

    let contents = '';
    try {
        contents = await readFile(hostsFilePath, 'utf8');
    } catch (error) {
        if (error?.code === 'ENOENT') {
            throw createHostsNotFoundError(hostsFilePath, error);
        }

        if (error?.code === 'EACCES' || error?.code === 'EPERM') {
            throw createHostsPermissionError(hostsFilePath, error);
        }

        throw error;
    }

    const missingHosts = requiredHosts.filter((host) => !isHostMappedToLocalhost(contents, host));
    if (missingHosts.length === 0) {
        console.log('Verified hosts file entries for the *.gredice.local domains.');
        return;
    }

    const newline = contents.includes('\r\n') ? '\r\n' : '\n';
    const needsLeadingNewline = contents.length > 0 && !contents.endsWith('\n') && !contents.endsWith('\r');
    const hostsEntry = `127.0.0.1 ${missingHosts.join(' ')}`;

    let textToAppend = '';
    if (needsLeadingNewline) {
        textToAppend += newline;
    }

    textToAppend += hostsEntry;
    textToAppend += newline;

    try {
        await appendFile(hostsFilePath, textToAppend, { encoding: 'utf8' });
    } catch (error) {
        if (error?.code === 'EACCES' || error?.code === 'EPERM') {
            throw createHostsPermissionError(hostsFilePath, error);
        }

        throw error;
    }

    console.log(`Added missing hosts entry for ${missingHosts.join(', ')} to ${hostsFilePath}.`);
    console.log(`The following line was appended: ${hostsEntry}`);
}

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
            shell: process.platform === 'win32',
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
            await ensureHostsEntries();
        } catch (error) {
            if (error?.code === 'HOSTS_PERMISSION_DENIED') {
                console.error('Unable to update the hosts file automatically because elevated permissions are required.');
                if (error?.hostsFilePath) {
                    console.error(`Hosts file: ${error.hostsFilePath}`);
                }
                console.error('Re-run this command with administrative privileges or add the following entry manually:');
                console.error(requiredHostsLine);
                if (process.platform === 'win32') {
                    console.error('Tip: run this command from an elevated PowerShell or Command Prompt.');
                } else {
                    console.error('Tip: run `sudo pnpm dev` once to add the entries, then rerun without sudo.');
                }
                return 1;
            }

            if (error?.code === 'HOSTS_FILE_NOT_FOUND') {
                if (error?.hostsFilePath) {
                    console.error(`Unable to locate the hosts file at ${error.hostsFilePath}.`);
                } else {
                    console.error('Unable to locate the system hosts file.');
                }
                console.error('Add the following entry manually and rerun the command:');
                console.error(requiredHostsLine);
                return 1;
            }

            console.error('Failed to verify the hosts file entries required by the local dev proxy.');
            if (error?.message) {
                console.error(error.message);
            }
            return 1;
        }

        try {
            await startProxy();
            console.log('Apps will be available on the *.gredice.local subdomains once Turbo finishes booting.');
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
