#!/usr/bin/env node

/**
 * Syncs app/flags.ts with the generated Hypertune flag definitions.
 * Adds new flags and removes deprecated ones, keeping flags.ts in sync
 * with lib/flags/generated/hypertune.ts.
 *
 * Usage: node scripts/sync-flags.mjs [appDir...]
 *   If no appDirs given, scans all apps with flags infrastructure.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const rootDir = new URL('..', import.meta.url).pathname;

/** Apps that have the flags SDK infrastructure */
const flagApps = ['apps/garden', 'apps/www', 'apps/farm'];

function extractFlagNames(hypertuneFilePath) {
    const content = readFileSync(hypertuneFilePath, 'utf-8');

    // Extract flag names from "export type FlagValues = { ... }"
    const match = content.match(/export type FlagValues = \{([^}]+)\}/);
    if (!match) {
        return [];
    }

    const flagNames = [];
    for (const line of match[1].split('\n')) {
        const flagMatch = line.match(/"(\w+)":\s/);
        if (flagMatch) {
            flagNames.push(flagMatch[1]);
        }
    }
    return flagNames;
}

function flagExportName(flagName) {
    return `${flagName}Flag`;
}

function generateFlagsFile(flagNames, hypertuneRelPath, identifyRelPath) {
    const declarations = flagNames
        .map(
            (name) =>
                `export const ${flagExportName(name)} = flag(\n    hypertuneAdapter.declarations.${name},\n);`,
        )
        .join('\n');

    return `import { createHypertuneAdapter } from '@flags-sdk/hypertune';
import { flag } from 'flags/next';
import {
    type Context,
    createSource,
    type FlagValues,
    vercelFlagDefinitions as flagDefinitions,
    flagFallbacks,
} from '${hypertuneRelPath}';
import { identify } from '${identifyRelPath}';

const hypertuneAdapter = createHypertuneAdapter<FlagValues, Context>({
    createSource,
    flagDefinitions,
    flagFallbacks,
    identify,
});

${declarations}
`;
}

function syncApp(appDir) {
    const absAppDir = join(rootDir, appDir);
    const hypertuneFile = join(absAppDir, 'lib/flags/generated/hypertune.ts');
    const flagsFile = join(absAppDir, 'app/flags.ts');
    const identifyFile = join(absAppDir, 'lib/flags/identify.ts');

    if (!existsSync(hypertuneFile)) {
        console.log(`  Skipping ${appDir}: no hypertune.ts found`);
        return;
    }

    if (!existsSync(identifyFile)) {
        console.log(`  Skipping ${appDir}: no identify.ts found`);
        return;
    }

    const flagNames = extractFlagNames(hypertuneFile);
    if (flagNames.length === 0) {
        console.log(`  Skipping ${appDir}: no flags found in FlagValues`);
        return;
    }

    // Compute relative import paths from app/flags.ts
    const hypertuneRelPath = '../lib/flags/generated/hypertune';
    const identifyRelPath = '../lib/flags/identify';

    const content = generateFlagsFile(flagNames, hypertuneRelPath, identifyRelPath);
    const existing = existsSync(flagsFile) ? readFileSync(flagsFile, 'utf-8') : '';

    if (existing === content) {
        console.log(`  ${appDir}: flags.ts is up to date (${flagNames.length} flags)`);
        return;
    }

    writeFileSync(flagsFile, content, 'utf-8');

    // Diff report
    const existingExports = [...existing.matchAll(/export const (\w+Flag)/g)].map((m) => m[1]);
    const newExports = flagNames.map(flagExportName);
    const added = newExports.filter((e) => !existingExports.includes(e));
    const removed = existingExports.filter((e) => !newExports.includes(e));

    console.log(`  ${appDir}: updated flags.ts (${flagNames.length} flags)`);
    if (added.length > 0) console.log(`    + added: ${added.join(', ')}`);
    if (removed.length > 0) console.log(`    - removed: ${removed.join(', ')}`);
}

// Main
const args = process.argv.slice(2);
const appsToSync = args.length > 0 ? args : flagApps;

console.log('Syncing flags.ts files...');
for (const appDir of appsToSync) {
    syncApp(appDir);
}
console.log('Done.');
