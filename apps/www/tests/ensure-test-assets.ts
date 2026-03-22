import { access, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(workspaceRoot, '..', '..');
const workspaceFilter = 'www';
const buildMarkerPath = path.join(workspaceRoot, '.next', 'BUILD_ID');
const sitemapIndexPath = path.join(workspaceRoot, 'public', 'sitemap.xml');
const sitemapPath = path.join(workspaceRoot, 'public', 'sitemap-0.xml');
const watchedPaths = [
    'app',
    'components',
    'generate',
    'hooks',
    'lib',
    'public',
    'src',
    'instrumentation.ts',
    'instrumentation-client.ts',
    'next.config.ts',
    'next-sitemap.config.cjs',
    'package.json',
    'tailwind.config.ts',
    'postcss.config.js',
    'tsconfig.json',
];
const ignoredDirectories = new Set([
    '.git',
    '.next',
    '.turbo',
    'coverage',
    'node_modules',
    'playwright-report',
    'test-results',
]);
const ignoredFiles = new Set(['.DS_Store', 'sitemap.xml', 'sitemap-0.xml']);

async function pathExists(filePath: string) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function getLatestModifiedAt(targetPath: string): Promise<number> {
    if (ignoredFiles.has(path.basename(targetPath))) {
        return 0;
    }

    const targetStat = await stat(targetPath);
    if (!targetStat.isDirectory()) {
        return targetStat.mtimeMs;
    }

    let latestModifiedAt = targetStat.mtimeMs;
    const entries = await readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
        if (ignoredDirectories.has(entry.name)) {
            continue;
        }
        if (ignoredFiles.has(entry.name)) {
            continue;
        }

        const entryPath = path.join(targetPath, entry.name);
        const entryModifiedAt = await getLatestModifiedAt(entryPath);
        latestModifiedAt = Math.max(latestModifiedAt, entryModifiedAt);
    }

    return latestModifiedAt;
}

async function getLatestSourceModifiedAt() {
    let latestModifiedAt = 0;
    for (const relativePath of watchedPaths) {
        const absolutePath = path.join(workspaceRoot, relativePath);
        if (!(await pathExists(absolutePath))) {
            continue;
        }

        const modifiedAt = await getLatestModifiedAt(absolutePath);
        latestModifiedAt = Math.max(latestModifiedAt, modifiedAt);
    }

    return latestModifiedAt;
}

async function runBuild() {
    await new Promise<void>((resolve, reject) => {
        const child = spawn(
            'pnpm',
            ['turbo', 'build', `--filter=${workspaceFilter}`],
            {
                cwd: repoRoot,
            env: process.env,
            stdio: 'inherit',
            },
        );

        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(
                new Error(
                    `pnpm turbo build --filter=${workspaceFilter} failed with exit code ${code ?? -1}`,
                ),
            );
        });
        child.on('error', reject);
    });
}

const requiredArtifacts = [buildMarkerPath, sitemapIndexPath, sitemapPath];
const missingArtifacts = await Promise.all(
    requiredArtifacts.map(async (artifactPath) => !(await pathExists(artifactPath))),
);

const shouldBuildBecauseMissing = missingArtifacts.some(Boolean);
const latestSourceModifiedAt = await getLatestSourceModifiedAt();
const artifactModifiedAt = shouldBuildBecauseMissing
    ? 0
    : Math.min(
          ...(await Promise.all(
              requiredArtifacts.map(async (artifactPath) =>
                  (await stat(artifactPath)).mtimeMs,
              ),
          )),
      );

const shouldBuildBecauseStale = latestSourceModifiedAt > artifactModifiedAt;

if (shouldBuildBecauseMissing || shouldBuildBecauseStale) {
    console.info(
        `Build artifacts are missing or stale. Running \`pnpm turbo build --filter=${workspaceFilter}\`.`,
    );
    await runBuild();
} else {
    console.info('Build artifacts are up to date. Skipping build.');
}