#!/usr/bin/env node

// Links every app to its Vercel project in one go.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appRegistry } from './app-registry.ts';

const vercelCommand = 'vercel';
const vercelScope = 'gredice';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const vercelApps = appRegistry.filter((app) => app.vercelProjectName);

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

function readLinkedProjectName(cwd) {
    const projectJsonPath = resolve(cwd, '.vercel', 'project.json');
    if (!existsSync(projectJsonPath)) {
        return undefined;
    }

    try {
        const link = JSON.parse(readFileSync(projectJsonPath, 'utf8'));
        if (typeof link === 'object' && link !== null && typeof link.projectName === 'string') {
            return link.projectName;
        }
    } catch {
        return undefined;
    }

    return undefined;
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

    return `${appName}: link command failed. See output above for details.`;
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

        const linkedProjectName = readLinkedProjectName(cwd);
        if (linkedProjectName === app.vercelProjectName) {
            console.log(`\nSkipping ${app.name}; already linked to Vercel project ${app.vercelProjectName}.`);
            continue;
        }

        console.log(`\nLinking ${app.name} to Vercel project ${app.vercelProjectName}...`);

        const result = await run(
            vercelCommand,
            [
                'link',
                '--yes',
                '--non-interactive',
                '--scope',
                vercelScope,
                '--project',
                app.vercelProjectName,
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

    console.log('\nFinished linking all apps to Vercel.');
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
