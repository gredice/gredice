import { realpathSync } from 'node:fs';
import { basename, dirname, resolve, sep } from 'node:path';

const resettablePlaywrightDirectories = new Set([
    'test-results',
    'playwright-report',
    'blob-report',
]);

function isResettableAppOutput(path) {
    // Be conservative across case-sensitive and case-insensitive volumes:
    // realpath can preserve caller casing even when both names alias one tree.
    const parts = path.toLowerCase().split(sep);
    return parts.some(
        (part, index) =>
            part === 'apps' &&
            parts[index + 1] &&
            (resettablePlaywrightDirectories.has(parts[index + 2]) ||
                (parts[index + 2] === 'playwright' &&
                    parts[index + 3] === '.cache')),
    );
}

function resolveExistingAncestor(path) {
    let ancestor = path;
    const missingParts = [];
    while (true) {
        try {
            return resolve(realpathSync(ancestor), ...missingParts);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            missingParts.unshift(basename(ancestor));
            const parent = dirname(ancestor);
            if (parent === ancestor) {
                throw error;
            }
            ancestor = parent;
        }
    }
}

/** Keep durable profiler evidence out of Playwright-owned cleanup trees. */
export function assertSafeGameProfileOutputDirectory(outDir) {
    const normalized = resolve(outDir);
    // Check the lexical path as well as its existing ancestor: an output may
    // not exist yet, or a custom path may alias a resettable tree via symlink.
    // Match app paths across checkouts because a frozen harness can write to
    // a different worktree. Historical report inputs are deliberately exempt.
    if (
        isResettableAppOutput(normalized) ||
        isResettableAppOutput(resolveExistingAncestor(normalized))
    ) {
        throw new Error(
            `Unsafe game-profile output directory: ${normalized}. Playwright may delete this tree; use .game-profile-results or another durable directory.`,
        );
    }
    return normalized;
}
