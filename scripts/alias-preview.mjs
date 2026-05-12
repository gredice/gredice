#!/usr/bin/env node

import { spawn } from 'node:child_process';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function sanitizeBranch(branch) {
  return branch
    .toLowerCase()
    .replace(/^refs\/heads\//, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { const t = c.toString(); stdout += t; process.stdout.write(t); });
    child.stderr.on('data', (c) => { const t = c.toString(); stderr += t; process.stderr.write(t); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function main() {
  const token = required('VERCEL_TOKEN');
  const scope = required('VERCEL_SCOPE');
  const deploymentUrl = required('VERCEL_DEPLOYMENT_URL');
  const previewDomain = required('GREDICE_PREVIEW_DOMAIN');
  const branch = required('GITHUB_HEAD_REF');

  const branchSlug = sanitizeBranch(branch);
  if (!branchSlug) throw new Error(`Branch name ${branch} results in empty slug`);

  const aliasDomain = `${branchSlug}.${previewDomain}`;
  console.log(`Aliasing ${deploymentUrl} to ${aliasDomain}`);

  const result = await run('vercel', [
    'alias',
    'set',
    deploymentUrl,
    aliasDomain,
    '--scope',
    scope,
    '--token',
    token,
  ]);

  if (result.code !== 0) {
    throw new Error(`vercel alias failed with exit code ${result.code}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
