#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    getAppByName,
    getAppDevPort,
    getWorktreeProxyHttpsPort,
    localAppHostnameUrl,
} from '../../../scripts/app-registry.ts';
import {
    childProcessTreeOptions,
    shutdownSignals,
    signalExitCode,
    terminateChildProcessTree,
} from '../../../scripts/process-tree.mjs';
import { buildRuntimeConfig, getDesktopApp } from './desktop-apps.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, '..');
const repoRoot = resolve(desktopRoot, '../..');
const appName = process.argv[2];
const desktopApp = getDesktopApp(appName);
const registryApp = getAppByName(desktopApp.appName);
const registryApiApp = getAppByName('api');
const localUrl = localAppHostnameUrl(
    registryApp,
    'localhost',
    getAppDevPort(registryApp),
);
const localApiUrl = localAppHostnameUrl(
    registryApiApp,
    'localhost',
    getAppDevPort(registryApiApp),
);
const proxyHttpsPort = Number.parseInt(
    process.env.GREDICE_PROXY_HTTPS_PORT ?? String(getWorktreeProxyHttpsPort()),
    10,
);
const proxyPortSegment = proxyHttpsPort === 443 ? '' : `:${proxyHttpsPort}`;
const localProxyUrl = `https://${registryApp.localDomain}${proxyPortSegment}`;
const localApiProxyUrl = `https://${registryApiApp.localDomain}${proxyPortSegment}`;
const config = buildRuntimeConfig(desktopApp, {
    trustedNavigationOrigins: [
        localApiProxyUrl,
        localApiUrl,
        localProxyUrl,
        localUrl,
    ],
    url: localUrl,
});
const configDir = resolve(desktopRoot, '.desktop-build', 'dev', appName);
const configPath = resolve(configDir, 'desktop-app.json');
const defaultElectronCommand = resolve(
    desktopRoot,
    'node_modules/.bin',
    process.platform === 'win32' ? 'electron.cmd' : 'electron',
);
const managedProcesses = [];
const signalNumbers = os.constants?.signals ?? {};
let shutdownPromise = null;
let requestedSignal = null;
let signalHandlers = [];

function pnpmInvocation(args) {
    const pnpmScript = process.env.npm_execpath?.trim();
    if (pnpmScript) {
        return {
            args: [pnpmScript, ...args],
            command: process.execPath,
            shell: false,
        };
    }

    return {
        args,
        command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
        shell: process.platform === 'win32',
    };
}

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        stdio: 'pipe',
    });

    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(' ')} failed: ${
                result.stderr || result.stdout
            }`,
        );
    }
}

function setPlistValue(plistPath, key, value) {
    const setResult = spawnSync(
        '/usr/libexec/PlistBuddy',
        ['-c', `Set :${key} ${value}`, plistPath],
        { encoding: 'utf8', stdio: 'pipe' },
    );

    if (setResult.status === 0) {
        return;
    }

    runCommand('/usr/libexec/PlistBuddy', [
        '-c',
        `Add :${key} string ${value}`,
        plistPath,
    ]);
}

async function pathExists(path) {
    return fs
        .access(path)
        .then(() => true)
        .catch(() => false);
}

async function ensureMacDevElectronApp() {
    if (process.platform !== 'darwin') {
        return defaultElectronCommand;
    }

    const sourceAppPath = resolve(
        desktopRoot,
        'node_modules/electron/dist/Electron.app',
    );
    const devAppPath = resolve(configDir, `${desktopApp.productName}.app`);
    const plistPath = resolve(devAppPath, 'Contents/Info.plist');
    const executablePath = resolve(devAppPath, 'Contents/MacOS/Electron');

    if (await pathExists(executablePath)) {
        return executablePath;
    }

    await fs.rm(devAppPath, { force: true, recursive: true });
    runCommand('ditto', [sourceAppPath, devAppPath]);

    setPlistValue(plistPath, 'CFBundleDisplayName', desktopApp.productName);
    setPlistValue(plistPath, 'CFBundleExecutable', 'Electron');
    setPlistValue(plistPath, 'CFBundleIdentifier', `${desktopApp.appId}.dev`);
    setPlistValue(plistPath, 'CFBundleName', desktopApp.productName);

    return executablePath;
}

function canConnectToUrl(targetUrl) {
    return new Promise((resolveConnection) => {
        const parsedUrl = new URL(targetUrl);
        const socket = net.createConnection({
            host: parsedUrl.hostname,
            port: Number.parseInt(parsedUrl.port, 10) || 80,
        });

        socket.setTimeout(500);

        socket.once('connect', () => {
            socket.destroy();
            resolveConnection(true);
        });

        socket.once('error', () => {
            socket.destroy();
            resolveConnection(false);
        });

        socket.once('timeout', () => {
            socket.destroy();
            resolveConnection(false);
        });
    });
}

function devServerLabel(app) {
    return `${app.name} dev server`;
}

async function waitForDevServer(app, url, { timeoutMs = 90_000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() <= deadline) {
        if (await canConnectToUrl(url)) {
            console.log(`${devServerLabel(app)} is ready at ${url}`);
            return;
        }

        await new Promise((resolveWait) => {
            setTimeout(resolveWait, 500);
        });
    }

    throw new Error(`${devServerLabel(app)} did not become ready at ${url}.`);
}

function spawnManaged(label, invocation, { exitOnUnexpectedExit = true } = {}) {
    const child = spawn(invocation.command, invocation.args, {
        cwd: repoRoot,
        env: {
            ...process.env,
            ...(invocation.env ?? {}),
        },
        shell: invocation.shell,
        stdio: 'inherit',
        ...childProcessTreeOptions(),
    });

    managedProcesses.push({ child, label });

    child.on('error', (error) => {
        if (error.code === 'ENOENT') {
            console.error(`Unable to find command for ${label}.`);
        } else {
            console.error(error);
        }

        void shutdownAndExit(1);
    });

    child.on('exit', (code, signal) => {
        if (shutdownPromise || !exitOnUnexpectedExit) {
            return;
        }

        const exitCode = signal
            ? signalExitCode(signal, signalNumbers)
            : (code ?? 0);
        console.error(`${label} exited with code ${exitCode}.`);
        void shutdownAndExit(exitCode);
    });

    return child;
}

async function ensureDevServer(app, url) {
    if (await canConnectToUrl(url)) {
        console.log(`${devServerLabel(app)} already running at ${url}`);
        return;
    }

    console.log(`Starting ${devServerLabel(app)} at ${url}`);
    spawnManaged(
        devServerLabel(app),
        pnpmInvocation(['--filter', app.name, 'dev']),
    );
    await waitForDevServer(app, url);
}

async function shutdownManagedProcesses(signal = 'SIGTERM') {
    await Promise.all(
        managedProcesses.map(({ child }) =>
            terminateChildProcessTree(child, {
                gracefulTimeoutMs: 8000,
                signal,
            }),
        ),
    );
}

async function shutdownAndExit(exitCode, signal = 'SIGTERM') {
    for (const [signalName, handler] of signalHandlers) {
        process.off(signalName, handler);
    }

    shutdownPromise ??= shutdownManagedProcesses(signal);
    await shutdownPromise;
    process.exit(exitCode);
}

signalHandlers = shutdownSignals.map((signal) => {
    const handler = () => {
        requestedSignal ??= signal;
        void shutdownAndExit(signalExitCode(signal, signalNumbers), signal);
    };
    process.on(signal, handler);
    return [signal, handler];
});

async function main() {
    await ensureDevServer(registryApiApp, localApiUrl);
    await ensureDevServer(registryApp, localUrl);

    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(
        `${configPath}.tmp`,
        `${JSON.stringify(config, null, 4)}\n`,
    );
    await fs.rename(`${configPath}.tmp`, configPath);
    const electronCommand = await ensureMacDevElectronApp();

    const electronChild = spawnManaged(
        'Electron desktop shell',
        {
            args: [resolve(desktopRoot, 'electron/main.cjs')],
            command: electronCommand,
            env: {
                GREDICE_DESKTOP_CONFIG: configPath,
                GREDICE_DESKTOP_DEV: '1',
            },
            shell: process.platform === 'win32',
        },
        { exitOnUnexpectedExit: false },
    );

    electronChild.on('exit', (code, signal) => {
        if (shutdownPromise) {
            return;
        }

        const exitSignal = signal ?? requestedSignal;
        const exitCode = exitSignal
            ? signalExitCode(exitSignal, signalNumbers)
            : (code ?? 0);
        void shutdownAndExit(exitCode, exitSignal ?? 'SIGTERM');
    });
}

main().catch((error) => {
    console.error(error);
    void shutdownAndExit(1);
});
