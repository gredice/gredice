/**
 * Workaround for react-email preview server esbuild version mismatch.
 *
 * @react-email/preview-server ships a pre-built .next directory that bundles
 * esbuild 0.25.10 JS, but the native @esbuild/* binary it resolves at runtime
 * may be a different version (e.g. 0.25.12 from the react-email CLI dependency).
 *
 * This script creates a symlink so the bundled esbuild JS finds the matching
 * native binary in .next/node_modules/@esbuild/<platform>.
 */

import { existsSync, mkdirSync, symlinkSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

try {
    // Find the preview-server .next/node_modules dir
    const previewServerDir = dirname(
        require.resolve('@react-email/preview-server/package.json'),
    );
    const nextNm = join(previewServerDir, '.next', 'node_modules');

    if (!existsSync(nextNm)) {
        process.exit(0);
    }

    // Find the bundled esbuild and extract its version
    const bundledEsbuildDirs = readdirSync(nextNm).filter((d) =>
        d.startsWith('esbuild-'),
    );
    if (bundledEsbuildDirs.length === 0) {
        process.exit(0);
    }

    const bundledEsbuildDir = join(nextNm, bundledEsbuildDirs[0]);
    const bundledPkg = JSON.parse(
        readFileSync(join(bundledEsbuildDir, 'package.json'), 'utf8'),
    );
    const bundledVersion = bundledPkg.version;

    // Determine current platform package name
    const platformKey = `${process.platform} ${process.arch} ${
        process.arch === 'ia32' || process.arch === 'x64' || process.arch === 'arm64'
            ? 'LE'
            : 'BE'
    }`;
    const platformMap = {
        'darwin arm64 LE': '@esbuild/darwin-arm64',
        'darwin x64 LE': '@esbuild/darwin-x64',
        'linux arm64 LE': '@esbuild/linux-arm64',
        'linux x64 LE': '@esbuild/linux-x64',
        'win32 x64 LE': '@esbuild/win32-x64',
        'win32 arm64 LE': '@esbuild/win32-arm64',
    };

    const pkg = platformMap[platformKey];
    if (!pkg) {
        process.exit(0);
    }

    const targetLink = join(nextNm, ...pkg.split('/'));
    if (existsSync(targetLink)) {
        process.exit(0);
    }

    // Find the matching native binary in pnpm store
    const pnpmDir = join(
        process.cwd(),
        'node_modules',
        '.pnpm',
        `${pkg.replace('/', '+')}@${bundledVersion}`,
        'node_modules',
        ...pkg.split('/'),
    );

    if (!existsSync(pnpmDir)) {
        console.warn(
            `[fix-esbuild] Could not find ${pkg}@${bundledVersion} at ${pnpmDir}`,
        );
        process.exit(0);
    }

    mkdirSync(dirname(targetLink), { recursive: true });
    // Use 'junction' on Windows (no elevated privileges needed), symlink elsewhere
    symlinkSync(pnpmDir, targetLink, process.platform === 'win32' ? 'junction' : 'dir');
    console.log(
        `[fix-esbuild] Linked ${pkg}@${bundledVersion} into preview-server .next`,
    );
} catch {
    // Non-fatal — only affects local dev
}
