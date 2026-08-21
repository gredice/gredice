import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
    findRestrictedUiPrimitives,
    validateUiPrimitives,
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

test('allows Base UI only inside the shared UI package', (context) => {
    const root = fixture({
        'packages/ui/package.json': JSON.stringify({
            dependencies: { '@base-ui/react': '1.7.0' },
        }),
        'packages/ui/src/BaseDialog.tsx':
            "import { Dialog } from '@base-ui/react/dialog';\n",
        'apps/www/page.tsx': "import { Modal } from '@gredice/ui/Modal';\n",
    });
    context.after(() => rmSync(root, { recursive: true }));

    const result = findRestrictedUiPrimitives(root);

    assert.deepEqual(result.unexpectedImports, []);
    assert.deepEqual(result.unexpectedDependencies, []);
    assert.equal(result.legacyImports.length, 0);
    assert.equal(result.legacyDependencies.length, 0);
    assert.equal(result.imports.length, 1);
    assert.equal(result.dependencies.length, 1);
});

test('keeps Base UI implementation imports inside packages/ui', (context) => {
    const root = fixture({
        'apps/www/component.tsx':
            "import { Dialog } from '@base-ui/react/dialog';\n",
    });
    context.after(() => rmSync(root, { recursive: true }));

    const result = findRestrictedUiPrimitives(root);

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

    const result = findRestrictedUiPrimitives(root);

    assert.deepEqual(result.unexpectedImports, [
        {
            file: 'apps/garden/component.tsx',
            line: 1,
            specifier: '@radix-ui/react-dialog',
        },
    ]);
});

test('rejects direct Radix and Vaul dependency declarations', (context) => {
    const root = fixture({
        'apps/garden/package.json': JSON.stringify({
            dependencies: { '@radix-ui/react-dialog': '1.1.18' },
            devDependencies: { vaul: '1.1.2' },
        }),
    });
    context.after(() => rmSync(root, { recursive: true }));

    const result = findRestrictedUiPrimitives(root);

    assert.deepEqual(result.unexpectedDependencies, [
        {
            field: 'dependencies',
            file: 'apps/garden/package.json',
            specifier: '@radix-ui/react-dialog',
        },
        {
            field: 'devDependencies',
            file: 'apps/garden/package.json',
            specifier: 'vaul',
        },
    ]);
    assert.throws(
        () => validateUiPrimitives(root),
        /declares primitive outside its approved boundary/u,
    );
});

test('rejects Base UI dependency declarations outside packages/ui', (context) => {
    const root = fixture({
        'apps/www/package.json': JSON.stringify({
            dependencies: { '@base-ui/react': '1.7.0' },
        }),
    });
    context.after(() => rmSync(root, { recursive: true }));

    assert.throws(
        () => validateUiPrimitives(root),
        /apps\/www\/package\.json declares primitive outside its approved boundary/u,
    );
});
