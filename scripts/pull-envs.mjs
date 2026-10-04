#!/usr/bin/env node

// Pulls Vercel environment variables for every app in one go.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRegistry } from './app-registry.ts';

const vercelCommand = 'vercel';
const vercelScope = 'gredice';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const vercelApps = appRegistry.filter((app) => app.vercelProjectName);

// Packages that don't have their own Vercel project but need values from an app .env.
// Source apps are tried in order; the first .env containing the key wins.
const sharedPackageEnvs = [
    {
        name: '@gredice/storage',
        targetEnv: resolve(repoRoot, 'packages', 'storage', '.env'),
        keys: ['POSTGRES_URL'],
        sourceAppOrder: ['api', 'www', 'app', 'garden', 'farm'],
    },
];

function getSpawnOptions(command, args) {
    if (process.platform !== 'win32') {
        return { command, args };
    }

    return {
        command: process.env.ComSpec ?? 'cmd.exe',
        args: ['/d', '/s', '/c', [command, ...args].join(' ')],
    };
}

function run(command, args, options) {
    return new Promise((resolvePromise, rejectPromise) => {
        const spawnOptions = getSpawnOptions(command, args);
        const child = spawn(spawnOptions.command, spawnOptions.args, {
            ...options,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (chunk) => {
            const text = chunk.toString();
            stdout += text;
            process.stdout.write(text);
        });

        child.stderr?.on('data', (chunk) => {
            const text = chunk.toString();
            stderr += text;
            process.stderr.write(text);
        });

        child.on('error', (error) => {
            rejectPromise(error);
        });

        child.on('close', (code) => {
            resolvePromise({ code: code ?? 1, stdout, stderr });
        });
    });
}

async function hasVercelCli() {
    const command = process.platform === 'win32' ? 'where.exe' : 'which';
    const result = await run(command, [vercelCommand], {
        env: process.env,
    });

    return result.code === 0;
}

function explainFailure(output, appName, projectName) {
    const combinedOutput = output.toLowerCase();

    if (
        combinedOutput.includes('not logged in') ||
        combinedOutput.includes('authentication') ||
        combinedOutput.includes('token')
    ) {
        return `${appName}: authentication failed. Run \`vercel login\` (or provide \`--token\`) and retry.`;
    }

    if (
        combinedOutput.includes('scope') ||
        combinedOutput.includes('team') ||
        combinedOutput.includes('forbidden') ||
        combinedOutput.includes('unauthorized')
    ) {
        return `${appName}: cannot access Vercel scope \`${vercelScope}\`. Verify your account has access to the team.`;
    }

    if (
        combinedOutput.includes('project') &&
        (combinedOutput.includes('not found') || combinedOutput.includes('could not'))
    ) {
        return `${appName}: could not resolve Vercel project \`${projectName}\`. Verify app registry project names.`;
    }

    return `${appName}: env pull command failed. See output above for details.`;
}

function findKeyLineInAppEnv(key, appName) {
    const app = appRegistry.find((candidate) => candidate.name === appName);
    if (!app) return undefined;
    const envPath = resolve(repoRoot, app.packagePath, '.env');
    if (!existsSync(envPath)) return undefined;

    const text = readFileSync(envPath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const candidateKey = trimmed.slice(0, eq).trim();
        if (candidateKey === key) {
            return { app: appName, line: rawLine };
        }
    }
    return undefined;
}

function populateSharedPackageEnvs() {
    for (const pkg of sharedPackageEnvs) {
        const lines = [];
        const sources = [];
        for (const key of pkg.keys) {
            let found;
            for (const appName of pkg.sourceAppOrder) {
                found = findKeyLineInAppEnv(key, appName);
                if (found) break;
            }
            if (!found) {
                console.warn(
                    `${pkg.name}: ${key} not found in any source app .env (tried ${pkg.sourceAppOrder.join(', ')}). Skipping.`,
                );
                continue;
            }
            lines.push(found.line);
            sources.push(`${key}<-${found.app}`);
        }

        if (lines.length === 0) {
            console.warn(`${pkg.name}: no keys copied; ${pkg.targetEnv} not updated.`);
            continue;
        }

        writeFileSync(pkg.targetEnv, `${lines.join('\n')}\n`);
        console.log(`\nWrote ${pkg.name} env (${sources.join(', ')}).`);
    }
}

async function main() {
    if (!(await hasVercelCli())) {
        console.error(
            'Vercel CLI was not found. Install it and make sure `vercel` is on PATH (for example, `pnpm add -Dw vercel` or `npm i -g vercel`).',
        );
        process.exit(1);
    }

    for (const app of vercelApps) {
        const cwd = resolve(repoRoot, app.packagePath);
        console.log(`\nPulling environment variables for ${app.name} (${app.vercelProjectName})...`);

        if (!existsSync(resolve(cwd, '.vercel', 'project.json'))) {
            console.error(`${app.name}: Vercel project link is missing. Run \`pnpm vercel:link\` and retry.`);
            process.exit(1);
        }

        const result = await run(
            vercelCommand,
            [
                'env',
                'pull',
                '.env',
                '--yes',
                '--environment=development',
                '--scope',
                vercelScope,
            ],
            {
                cwd,
                env: process.env,
            },
        );

        if (result.code !== 0) {
            const output = `${result.stdout}\n${result.stderr}`;
            console.error(explainFailure(output, app.name, app.vercelProjectName));
            process.exit(result.code ?? 1);
        }
    }

    populateSharedPackageEnvs();

    console.log('\nFinished pulling environment variables for all apps.');
}

main().catch((error) => {
    if (error?.code === 'ENOENT') {
        console.error(
            'A required command was not found. Make sure Vercel CLI is installed and available as `vercel` on PATH.',
        );
    } else if (error?.message) {
        console.error(error.message);
    } else if (error) {
        console.error(error);
    }

    process.exit(1);
});
