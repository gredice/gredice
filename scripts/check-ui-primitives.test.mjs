import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    findRestrictedUiPrimitiveImports,
    validateUiPrimitiveImports,
} from './check-ui-primitives.mjs';

function fixture(files) {
    const root = mkdtempSync(path.join(tmpdir(), 'gredice-ui-primitives-'));
    mkdirSync(path.join(root, 'apps'), { recursive: true });
    mkdirSync(path.join(root, 'packages'), { recursive: true });

    for (const [file, contents] of Object.entries(files)) {
        const absolutePath = path.join(root, file);
        mkdirSync(path.dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, contents);
    }

    return root;
}

test('allows only explicitly inventoried Radix and Vaul imports', (context) => {
    const root = fixture({
        'packages/ui/src/Modal.tsx': "import { Drawer } from 'vaul';\n",
        'packages/ui/src/BaseDialog.tsx':
            "import { Dialog } from '@base-ui/react/dialog';\n",
        'apps/www/page.tsx': "import { Modal } from '@gredice/ui/Modal';\n",
    });
    context.after(() => rmSync(root, { recursive: true }));

    const result = findRestrictedUiPrimitiveImports(
        root,
        new Set(['packages/ui/src/Modal.tsx']),
    );

    assert.deepEqual(result.unexpectedImports, []);
    assert.deepEqual(result.staleAllowlistEntries, []);
    assert.equal(result.legacyImports.length, 1);
    assert.equal(result.imports.length, 2);
});

test('keeps Base UI implementation imports inside packages/ui', (context) => {
    const root = fixture({
        'apps/www/component.tsx':
            "import { Dialog } from '@base-ui/react/dialog';\n",
    });
    context.after(() => rmSync(root, { recursive: true }));

    const result = findRestrictedUiPrimitiveImports(root, new Set());

    assert.deepEqual(result.unexpectedImports, [
        {
            file: 'apps/www/component.tsx',
            line: 1,
            specifier: '@base-ui/react/dialog',
        },
    ]);
});

test('reports new restricted imports with their source location', (context) => {
    const root = fixture({
        'apps/garden/component.tsx':
            "const dialog = import('@radix-ui/react-dialog');\n",
    });
    context.after(() => rmSync(root, { recursive: true }));

    const result = findRestrictedUiPrimitiveImports(root, new Set());

    assert.deepEqual(result.unexpectedImports, [
        {
            file: 'apps/garden/component.tsx',
            line: 1,
            specifier: '@radix-ui/react-dialog',
        },
    ]);
});

test('rejects stale allowlist entries so migration slices shrink the boundary', (context) => {
    const root = fixture({
        'packages/ui/src/Button.tsx': 'export function Button() {}\n',
    });
    context.after(() => rmSync(root, { recursive: true }));

    assert.throws(
        () =>
            validateUiPrimitiveImports(
                root,
                new Set(['packages/ui/src/Migrated.tsx']),
            ),
        /stale temporary allowlist entry/u,
    );
});
