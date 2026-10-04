#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';

function appendGithubEnv(name, value) {
    const githubEnvPath = process.env.GITHUB_ENV;
    if (!githubEnvPath) {
        return;
    }

    fs.appendFileSync(githubEnvPath, `${name}=${value}\n`);
}

function hasValue(name) {
    return (process.env[name] ?? '').trim().length > 0;
}

function requireEnv(name) {
    if (hasValue(name)) {
        return process.env[name].trim();
    }

    console.error(`::error::Missing required GitHub secret: ${name}`);
    process.exitCode = 1;
    return '';
}

function hasAny(names) {
    return names.some((name) => hasValue(name));
}

function requireAll(names) {
    for (const name of names) {
        requireEnv(name);
    }
}

function writeApiKeyFile() {
    const apiKeyContent = requireEnv('APPLE_API_KEY_CONTENT');
    const apiKeyId = requireEnv('APPLE_API_KEY_ID');

    if (!apiKeyContent || !apiKeyId) {
        return;
    }

    const keyPath = resolve(
        process.env.RUNNER_TEMP ?? os.tmpdir(),
        `AuthKey_${apiKeyId}.p8`,
    );

    fs.writeFileSync(keyPath, apiKeyContent, { mode: 0o600 });
    appendGithubEnv('APPLE_API_KEY', keyPath);
    console.log(`Prepared App Store Connect API key at ${keyPath}`);
}

const appleIdNames = [
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
];
const apiKeyNames = [
    'APPLE_API_KEY_CONTENT',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER',
];

if (!hasValue('CSC_LINK')) {
    appendGithubEnv('GREDICE_DESKTOP_SKIP_MAC_NOTARIZATION', '1');
    console.warn(
        '::warning::CSC_LINK is not configured. The macOS desktop artifact will use ad-hoc signing and will not be notarized.',
    );
    process.exit(0);
}

console.log('Using configured Developer ID certificate for macOS signing.');

if (hasAny(appleIdNames)) {
    requireAll(appleIdNames);
    console.log('Using Apple ID credentials for macOS notarization.');
} else if (hasAny(apiKeyNames)) {
    requireAll(apiKeyNames);
    writeApiKeyFile();
    console.log('Using App Store Connect API key for macOS notarization.');
} else if (hasAny(['APPLE_KEYCHAIN', 'APPLE_KEYCHAIN_PROFILE'])) {
    requireEnv('APPLE_KEYCHAIN_PROFILE');
    console.log('Using keychain profile credentials for macOS notarization.');
} else {
    console.warn(
        '::warning::No macOS notarization credentials configured. The artifact will be signed when possible, but not notarized.',
    );
}
