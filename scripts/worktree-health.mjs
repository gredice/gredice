#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';
import net from 'node:net';
import { appRegistry, getAppDevPort, getComponentTestPort } from './app-registry.ts';

const mode = process.argv[2] === 'setup' ? 'setup' : 'doctor';
const rootDir = resolve(new URL('..', import.meta.url).pathname);
const requiredHostsLine = `127.0.0.1 ${appRegistry.map((a) => a.localDomain).join(' ')}`;
const caddyDataDir = process.env.GREDICE_DEV_CADDY_DATA_DIR || resolve(os.homedir(), '.gredice', 'dev-caddy');
const caddyCert = resolve(caddyDataDir, 'caddy', 'pki', 'authorities', 'local', 'root.crt');

const checks = [];
function addCheck(name, required, ok, detail, next) { checks.push({ name, required, ok, detail, next }); }
function run(cmd, args, options = {}) { return spawnSync(cmd, args, { encoding: 'utf8', ...options }); }

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  addCheck('Node.js >=24', true, major >= 24, `Detected ${process.versions.node}.`, 'Install Node.js >=24 and retry.');
}

function checkPnpm() {
  const r = run('pnpm', ['--version']);
  const v = (r.stdout || '').trim();
  addCheck('pnpm 10.33.2', true, r.status === 0 && v === '10.33.2', `Detected ${v || 'not found'}.`, 'Use corepack and pin pnpm 10.33.2.');
}

function checkDependencies() {
  const ok = existsSync(resolve(rootDir, 'node_modules'));
  addCheck('Dependencies installed', true, ok, ok ? 'node_modules exists.' : 'node_modules missing.', 'Run `pnpm install`.');
}

function checkDocker() {
  const r = run('docker', ['info']);
  addCheck('Docker available and running', true, r.status === 0, r.status === 0 ? 'Docker daemon reachable.' : 'Docker daemon unavailable.', 'Start Docker Desktop/daemon.');
}

function checkVercelAuth() {
  const r = run('vercel', ['whoami']);
  addCheck('Vercel auth', true, r.status === 0, r.status === 0 ? `Logged in as ${(r.stdout || '').trim()}.` : 'Not authenticated.', 'Run `vercel login`.');
}

function checkVercelLinks() {
  const missing = appRegistry.filter((app) => !existsSync(resolve(rootDir, app.packagePath, '.vercel', 'project.json')));
  addCheck('Vercel project links', true, missing.length === 0, missing.length === 0 ? 'All apps linked.' : `Missing links: ${missing.map((m) => m.name).join(', ')}.`, 'Run `pnpm vercel:link`.');
}

function checkEnvFiles() {
  const missing = appRegistry.filter((app) => !existsSync(resolve(rootDir, app.packagePath, '.env')));
  addCheck('App env files', true, missing.length === 0, missing.length === 0 ? 'All app .env files present.' : `Missing .env in: ${missing.map((m) => m.name).join(', ')}.`, 'Run `pnpm env:pull`.');
}

function checkPlaywright() {
  const r = run('pnpm', ['exec', 'playwright', '--version']);
  const ok = r.status === 0;
  addCheck('Playwright browsers', true, ok, ok ? `Playwright available: ${(r.stdout || '').trim()}.` : 'Playwright runtime missing.', 'Run `pnpm exec playwright install`.');
}

function checkHosts() {
  const hostsPath = process.platform === 'win32' ? resolve(process.env.SystemRoot || 'C:/Windows', 'System32', 'drivers', 'etc', 'hosts') : '/etc/hosts';
  let ok = false;
  let detail = `Checked ${hostsPath}.`;
  try {
    const contents = run('cat', [hostsPath]).stdout || '';
    ok = requiredHostsLine.split(' ').slice(1).every((domain) => new RegExp(`\\b${domain}\\b`).test(contents));
    detail = ok ? 'All gredice.test hostnames are present.' : `Missing one or more gredice.test hostnames in ${hostsPath}.`;
  } catch {
    detail = `Could not read ${hostsPath}.`;
  }
  addCheck('Hosts entries', true, ok, detail, `Add this line to hosts: ${requiredHostsLine}`);
}

function checkCertificate() {
  const ok = existsSync(caddyCert);
  addCheck('Caddy local certificate', false, ok, ok ? `Certificate found at ${caddyCert}.` : `Certificate not found at ${caddyCert}.`, 'Run `pnpm dev` once, then trust the certificate if prompted.');
}

function checkPorts() {
  const ports = new Set([80, 443]);
  for (const app of appRegistry) {
    ports.add(getAppDevPort(app));
    if (app.componentTestPort) {
      ports.add(getComponentTestPort(app));
    }
    ports.add(app.testPort);
  }

  const probes = [...ports].map((port) => new Promise((resolveProbe) => {
    const server = net.createServer();
    server.once('error', () => resolveProbe(port));
    server.once('listening', () => server.close(() => resolveProbe(undefined)));
    server.listen(port, '127.0.0.1');
  }));

  return Promise.all(probes).then((blockedPorts) => {
    const blocked = blockedPorts.filter(Boolean);
    addCheck('Local ports available', true, blocked.length === 0, blocked.length === 0 ? 'All required ports appear free.' : `Ports in use: ${blocked.join(', ')}.`, 'Stop conflicting processes before running `pnpm dev` or tests.');
  });
}

async function maybeRunSetupActions() {
  if (mode !== 'setup') return;
  console.log('\nRunning setup actions...');
  run('pnpm', ['install'], { stdio: 'inherit' });
  run('pnpm', ['vercel:link'], { stdio: 'inherit' });
  run('pnpm', ['env:pull'], { stdio: 'inherit' });
  run('pnpm', ['exec', 'playwright', 'install'], { stdio: 'inherit' });
}

function printResults() {
  console.log(`\nGredice ${mode} report\n`);
  for (const c of checks) {
    const icon = c.ok ? '✅' : c.required ? '❌' : '⚠️';
    console.log(`${icon} ${c.name}: ${c.detail}`);
    if (!c.ok && c.next) {
      console.log(`   → ${c.next}`);
    }
  }

  const failedRequired = checks.some((c) => c.required && !c.ok);
  if (failedRequired) {
    console.error(`\n${mode} failed: fix required checks above.`);
    process.exit(1);
  }

  console.log(`\n${mode} completed.`);
}

checkNode();
checkPnpm();
checkDependencies();
checkDocker();
checkVercelAuth();
checkVercelLinks();
checkEnvFiles();
checkPlaywright();
checkHosts();
checkCertificate();
await checkPorts();
await maybeRunSetupActions();
printResults();
