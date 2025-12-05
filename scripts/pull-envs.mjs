#!/usr/bin/env node

// Pulls Vercel environment variables for every app in one go.

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const vercelCommand = process.platform === 'win32' ? 'vercel.cmd' : 'vercel';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const appNames = ['www', 'garden', 'farm', 'app', 'api'];

function run(command, args, options) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(command, args, {
            ...options,
            stdio: 'inherit',
        });

        child.on('error', (error) => {
            rejectPromise(error);
        });

        child.on('close', (code) => {
            resolvePromise(code ?? 1);
        });
    });
}

async function main() {
    for (const appName of appNames) {
        const cwd = resolve(repoRoot, 'apps', appName);
        console.log(`\nPulling environment variables for ${appName}...`);

        const code = await run(vercelCommand, ['env', 'pull', '.env'], {
            cwd,
            env: process.env,
        });

        if (code !== 0) {
            console.error(`Vercel env pull failed for ${appName}.`);
            process.exit(code ?? 1);
        }
    }

    console.log('\nFinished pulling environment variables for all apps.');
}

main().catch((error) => {
    if (error?.code === 'ENOENT') {
        console.error(
            'Vercel CLI was not found. Install it first (e.g. `pnpm dlx vercel@latest` or `npm i -g vercel`).',
        );
    } else if (error?.message) {
        console.error(error.message);
    } else if (error) {
        console.error(error);
    }

    process.exit(1);
});
