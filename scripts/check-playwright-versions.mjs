import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

for (const appPath of process.argv.slice(2)) {
    const manifestPath = resolve(appPath, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const dependencies = {
        ...manifest.dependencies,
        ...manifest.devDependencies,
    };
    if (!dependencies['@playwright/test']) continue;

    const appRequire = createRequire(manifestPath);
    const runnerPath = appRequire.resolve('@playwright/test/package.json');
    const runner = JSON.parse(readFileSync(runnerPath, 'utf8'));
    const runnerRequire = createRequire(runnerPath);
    const playwrightPath = runnerRequire.resolve('playwright/package.json');
    const playwright = JSON.parse(readFileSync(playwrightPath, 'utf8'));
    const corePath = createRequire(playwrightPath).resolve(
        'playwright-core/package.json',
    );
    const core = JSON.parse(readFileSync(corePath, 'utf8'));
    assert.equal(
        playwright.version,
        runner.version,
        `${appPath}: runner/browser mismatch`,
    );
    assert.equal(
        core.version,
        runner.version,
        `${appPath}: runner/core mismatch`,
    );

    if (dependencies['@playwright/experimental-ct-react']) {
        const componentPath = appRequire.resolve(
            '@playwright/experimental-ct-react/package.json',
        );
        const component = JSON.parse(readFileSync(componentPath, 'utf8'));
        const componentCoreEntry = createRequire(componentPath).resolve(
            '@playwright/experimental-ct-core',
        );
        const componentCore = JSON.parse(
            readFileSync(
                resolve(dirname(componentCoreEntry), 'package.json'),
                'utf8',
            ),
        );
        const componentRunnerPath =
            createRequire(componentCoreEntry).resolve('playwright/test');
        assert.equal(
            component.version,
            runner.version,
            `${appPath}: component/runner mismatch`,
        );
        assert.equal(
            componentCore.version,
            runner.version,
            `${appPath}: component core/runner mismatch`,
        );
        assert.equal(
            componentRunnerPath,
            runnerRequire.resolve('playwright/test'),
            `${appPath}: component tests load a second runner`,
        );
    }
    console.log(`${appPath}: aligned Playwright ${runner.version}`);
}
