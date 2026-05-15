#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import { appRegistry, getAppDevPort, getComponentTestPort, getWorktreeSlug } from './app-registry.ts';

const mode = process.argv[2] === 'setup' ? 'setup' : 'doctor';
const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requiredHostsLine = `127.0.0.1 ${appRegistry.map((a) => a.localDomain).join(' ')}`;
const caddyDataDir = process.env.GREDICE_DEV_CADDY_DATA_DIR || resolve(os.homedir(), '.gredice', 'dev-caddy', getWorktreeSlug());
const caddyCert = resolve(caddyDataDir, 'caddy', 'pki', 'authorities', 'local', 'root.crt');

const checks = [];
function addCheck(name, required, ok, detail, next) { checks.push({ name, required, ok, detail, next }); }
function run(cmd, args, options = {}) {
  const shell = options.shell ?? process.platform === 'win32';
  const finalCmd = shell && /\s/.test(cmd) ? `"${cmd}"` : cmd;
  return spawnSync(finalCmd, args, { encoding: 'utf8', ...options, shell });
}
function hasFailedRequiredChecks() { return checks.some((c) => c.required && !c.ok); }
function readConfiguredPnpm() {
  const packageJsonPath = resolve(rootDir, 'package.json');
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const packageManager = typeof packageJson.packageManager === 'string' ? packageJson.packageManager : '';
    const versionMatch = /^pnpm@([^+\s]+)(?:\+.+)?$/.exec(packageManager);
    if (!versionMatch) {
      return { ok: false, detail: packageManager ? `Unsupported packageManager: ${packageManager}.` : 'Missing packageManager in package.json.' };
    }
    return { ok: true, packageManager, version: versionMatch[1] };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, detail: `Could not read ${packageJsonPath}: ${message}.` };
  }
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  addCheck('Node.js >=24', true, major >= 24, `Detected ${process.versions.node}.`, 'Install Node.js >=24 and retry.');
}

function checkPnpm() {
  const configured = readConfiguredPnpm();
  if (!configured.ok) {
    addCheck('pnpm packageManager', true, false, configured.detail, 'Set the root packageManager field to pnpm@<version>.');
    return;
  }

  const r = run('pnpm', ['--version']);
  const v = (r.stdout || '').trim();
  addCheck(`pnpm ${configured.version}`, true, r.status === 0 && v === configured.version, `Detected ${v || 'not found'}; expected ${configured.packageManager}.`, 'Run `corepack install` from the repo root and retry.');
}

function checkDependencies() {
  const ok = existsSync(resolve(rootDir, 'node_modules'));
  addCheck('Dependencies installed', true, ok, ok ? 'node_modules exists.' : 'node_modules missing.', 'Run `pnpm install`.');
}

function checkDocker() {
  const r = run('docker', ['info']);
  addCheck(
    'Docker available and running',
    true,
    r.status === 0,
    r.status === 0
      ? 'Docker daemon reachable.'
      : 'Docker daemon unavailable. `pnpm dev` and Docker-backed tests require Docker.',
    'Start Docker Desktop/daemon. For Dockerless storage tests, set GREDICE_STORAGE_TEST_DB_ADMIN_URL to a local Postgres admin URL.'
  );
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
  const r = run('pnpm', ['--filter', 'www', 'exec', 'playwright', '--version']);
  const ok = r.status === 0;
  addCheck('Playwright browsers', true, ok, ok ? `Playwright available: ${(r.stdout || '').trim()}.` : 'Playwright runtime missing.', 'Run `pnpm --filter www exec playwright install`.');
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


function readRequiredBlenderVersion() {
  const versionFile = resolve(rootDir, 'assets', 'BLENDER_VERSION');
  if (!existsSync(versionFile)) {
    return { error: `Missing ${versionFile}.` };
  }

  const raw = readFileSync(versionFile, 'utf8').trim();
  const match = raw.match(/^(\d+)\.(\d+)$/);
  if (!match) {
    return { error: `Invalid Blender version format in assets/BLENDER_VERSION: "${raw}". Expected MAJOR.MINOR.` };
  }

  return { major: Number(match[1]), minor: Number(match[2]), raw };
}

function extractInstalledBlenderMajorMinor(output) {
  const firstLine = output.split(/\r?\n/)[0] || '';
  const match = firstLine.match(/Blender\s+(\d+)\.(\d+)/i);
  if (!match) return undefined;
  return { major: Number(match[1]), minor: Number(match[2]), line: firstLine.trim() };
}

function checkBlenderVersion() {
  const required = readRequiredBlenderVersion();
  if (required.error) {
    addCheck('Blender version', false, false, required.error, 'Create assets/BLENDER_VERSION with MAJOR.MINOR (example: 4.5).');
    return;
  }

  if (process.platform !== 'darwin' && process.platform !== 'win32') {
    addCheck('Blender version', false, false, `Optional: install Blender ${required.raw}. Automatic detection is supported on macOS and Windows.`, 'See WORKSPACE.md game-assets section for platform-specific export setup.');
    return;
  }

  const candidates = process.platform === 'darwin'
    ? [
      { cmd: '/Applications/Blender.app/Contents/MacOS/Blender', args: ['--version'] },
      { cmd: 'blender', args: ['--version'] },
    ]
    : [
      { cmd: 'blender', args: ['--version'] },
      { cmd: `C:/Program Files/Blender Foundation/Blender ${required.raw}/blender.exe`, args: ['--version'] },
    ];

  let installed;
  for (const candidate of candidates) {
    const r = run(candidate.cmd, candidate.args);
    if (r.status === 0) {
      const parsed = extractInstalledBlenderMajorMinor(`${r.stdout || ''}
${r.stderr || ''}`);
      if (parsed) {
        installed = parsed;
        break;
      }
    }
  }

  if (!installed) {
    addCheck('Blender version', false, false, `Optional: Blender not detected. Install Blender ${required.raw} to work with game assets.`, 'See WORKSPACE.md game-assets section for expected install paths.');
    return;
  }

  const ok = installed.major === required.major && installed.minor === required.minor;
  addCheck('Blender version', false, ok, ok ? `Detected ${installed.line}. Required ${required.raw}.` : `Detected ${installed.line}. Required ${required.raw} (major.minor must match).`, 'Install the required Blender major/minor version to avoid asset export incompatibilities.');
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

function spawnTagged(tag, cmd, args) {
  return new Promise((resolvePromise) => {
    const shell = process.platform === 'win32';
    const finalCmd = shell && /\s/.test(cmd) ? `"${cmd}"` : cmd;
    const child = spawn(finalCmd, args, { shell, stdio: ['ignore', 'pipe', 'pipe'] });

    const pipe = (stream, target) => {
      let buffer = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        buffer += chunk;
        let nl;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          target.write(`[${tag}] ${buffer.slice(0, nl + 1)}`);
          buffer = buffer.slice(nl + 1);
        }
      });
      stream.on('end', () => {
        if (buffer) target.write(`[${tag}] ${buffer}\n`);
      });
    };
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);

    child.on('error', () => resolvePromise(1));
    child.on('close', (code) => resolvePromise(code ?? 1));
  });
}

async function runChain(tag, actions) {
  for (const action of actions) {
    console.log(`\n[${tag}] ${action.label}...`);
    const code = await spawnTagged(tag, action.cmd, action.args);
    if (code !== 0) {
      console.error(`\n[${tag}] Setup action failed: ${action.label}.`);
      return { label: action.label, code };
    }
  }
  return null;
}

async function maybeRunSetupActions() {
  if (mode !== 'setup') return;
  console.log('\nRunning setup actions (install chain || vercel chain)...');

  const installChain = [
    { label: 'Installing dependencies', cmd: 'pnpm', args: ['install'] },
    { label: 'Installing Playwright browsers', cmd: 'pnpm', args: ['--filter', 'www', 'exec', 'playwright', 'install'] },
  ];
  const vercelChain = [
    { label: 'Linking Vercel projects', cmd: 'pnpm', args: ['vercel:link'] },
    { label: 'Pulling Vercel environment variables', cmd: 'pnpm', args: ['env:pull'] },
  ];

  const [installResult, vercelResult] = await Promise.all([
    runChain('install', installChain),
    runChain('vercel', vercelChain),
  ]);

  const failure = installResult ?? vercelResult;
  if (failure) {
    process.exit(failure.code || 1);
  }
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

async function runChecks() {
  checks.length = 0;
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
  checkBlenderVersion();
  await checkPorts();
}

if (mode === 'setup') {
  checks.length = 0;
  checkNode();
  checkPnpm();
  if (hasFailedRequiredChecks()) {
    printResults();
  }
  await maybeRunSetupActions();
}

await runChecks();
printResults();
