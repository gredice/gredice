import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    buildRuntimeConfig,
    desktopAppNames,
    getDesktopApp,
} from '../scripts/desktop-apps.mjs';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '../../..');
const require = createRequire(import.meta.url);
const {
    createDesktopOAuthCallbackRedirectUrl,
} = require('../electron/oauth-redirect.cjs');

const farmOrigin = 'https://farma.gredice.com';

function desktopOAuthCallback({
    nestedRedirect,
    provider = 'google',
    redirectValues,
} = {}) {
    const authUrl = new URL(`/api/gredice/api/auth/${provider}`, farmOrigin);
    for (const redirectValue of redirectValues ?? [nestedRedirect]) {
        if (redirectValue !== undefined) {
            authUrl.searchParams.append('redirect', redirectValue);
        }
    }

    return createDesktopOAuthCallbackRedirectUrl({
        protocol: 'gredice-farm',
        provider,
        sourceAuthUrl: authUrl,
        trustedNavigationOrigins: new Set([farmOrigin]),
    });
}

function webOAuthCallback(provider = 'google') {
    return new URL(`/prijava/${provider}-prijava/povratak`, farmOrigin);
}

test('desktop release configs use production HTTPS app origins', () => {
    assert.deepEqual(desktopAppNames, ['garden', 'farm', 'app']);

    for (const appName of desktopAppNames) {
        const desktopApp = getDesktopApp(appName);
        const runtimeConfig = buildRuntimeConfig(desktopApp);
        const appUrl = new URL(runtimeConfig.url);

        assert.equal(appUrl.protocol, 'https:');
        assert.equal(runtimeConfig.appName, appName);
        assert.equal(
            runtimeConfig.externalAuthBaseUrl,
            'https://api.gredice.com',
        );
        assert.match(runtimeConfig.protocol, /^gredice-/);
        assert.equal(runtimeConfig.trustedNavigationOrigins[0], desktopApp.url);
        assert.ok(fs.existsSync(resolve(repoRoot, desktopApp.iconPath)));
        assert.ok(fs.existsSync(resolve(repoRoot, desktopApp.faviconPath)));
    }
});

test('desktop shell enables macOS glass window styling', () => {
    const mainSource = fs.readFileSync(
        resolve(repoRoot, 'apps/desktop/electron/main.cjs'),
        'utf8',
    );

    assert.match(mainSource, /transparent: true/);
    assert.match(mainSource, /titleBarStyle: 'hiddenInset'/);
    assert.match(mainSource, /trafficLightPosition/);
    assert.match(mainSource, /vibrancy: 'under-window'/);
    assert.match(mainSource, /visualEffectState: 'active'/);
    assert.match(mainSource, /function isDesktopDevMode/);
    assert.match(mainSource, /GREDICE_DESKTOP_DEV/);
    assert.match(mainSource, /app\.dock\.setIcon\(iconPath\)/);
    assert.match(mainSource, /gredice-desktop-glass-background/);
    assert.match(mainSource, /--gredice-desktop-shell: 1/);
    assert.match(mainSource, /svg\[viewBox='0 0 163 44'\]/);
    assert.match(mainSource, /-webkit-app-region: drag/);
    assert.match(mainSource, /-webkit-app-region: no-drag/);
});

test('desktop shell integrates macOS traffic lights into the admin navigation', () => {
    const mainSource = fs.readFileSync(
        resolve(repoRoot, 'apps/desktop/electron/main.cjs'),
        'utf8',
    );
    const adminLayoutSource = fs.readFileSync(
        resolve(repoRoot, 'apps/app/app/admin/layout.tsx'),
        'utf8',
    );
    const desktopNavSource = fs.readFileSync(
        resolve(
            repoRoot,
            'apps/app/components/admin/navigation/DesktopNav.tsx',
        ),
        'utf8',
    );

    assert.match(
        mainSource,
        /runtimeConfig\.appName === 'app' \? \{ x: 32, y: 32 \}/,
    );
    assert.match(mainSource, /macosAdminGlassStyles/);
    assert.match(mainSource, /data-gredice-admin-nav-panel/);
    assert.match(mainSource, /hsl\(var\(--background, 0 0% 100%\)\) 34%/);
    assert.match(mainSource, /padding-top: 2\.75rem/);
    assert.match(mainSource, /--admin-page-content-background/);
    assert.match(mainSource, /background-clip: padding-box/);
    assert.match(mainSource, /min-height: calc\(100vh - 2rem\) !important/);
    assert.doesNotMatch(mainSource, /\[class\*='bg-muted'\]/);
    assert.match(mainSource, /body::before/);
    assert.match(mainSource, /display: none !important/);
    assert.match(adminLayoutSource, /data-gredice-admin-shell/);
    assert.match(adminLayoutSource, /data-gredice-admin-content-panel/);
    assert.match(desktopNavSource, /data-gredice-admin-nav/);
    assert.match(desktopNavSource, /data-gredice-admin-nav-panel/);
});

test('desktop shell hands OAuth login to the system browser', () => {
    const mainSource = fs.readFileSync(
        resolve(repoRoot, 'apps/desktop/electron/main.cjs'),
        'utf8',
    );
    const packageSource = fs.readFileSync(
        resolve(repoRoot, 'apps/desktop/scripts/package-desktop-app.mjs'),
        'utf8',
    );

    assert.match(mainSource, /openExternalOAuthLogin/);
    assert.match(mainSource, /GREDICE_DESKTOP_EXTERNAL_AUTH_BASE_URL/);
    assert.match(mainSource, /desktopAuthCallbackRedirectUrl/);
    assert.match(mainSource, /createDesktopOAuthCallbackRedirectUrl/);
    assert.match(mainSource, /api\\\/gredice\\\/api\\\/auth/);
    assert.match(mainSource, /setAsDefaultProtocolClient/);
    assert.match(mainSource, /auth-callback/);
    assert.match(packageSource, /protocols:/);
    assert.match(packageSource, /favicon\.ico/);
    assert.match(
        packageSource,
        /com\.apple\.security\.cs\.disable-library-validation/,
    );
    assert.match(packageSource, /installerIcon: 'favicon\.ico'/);
    assert.match(packageSource, /uninstallerIcon: 'favicon\.ico'/);
    assert.match(packageSource, /icon: 'favicon\.ico'/);
    assert.match(packageSource, /schemes: \[desktopApp\.protocol\]/);
    assert.match(packageSource, /oauth-redirect\.cjs/);
});

test('desktop OAuth preserves the nested Farm return path for each provider', () => {
    for (const provider of ['google', 'facebook']) {
        const nestedCallback = webOAuthCallback(provider);
        nestedCallback.searchParams.set(
            'returnTo',
            '/notifications?filter=unread#latest',
        );

        const result = desktopOAuthCallback({
            nestedRedirect: nestedCallback.toString(),
            provider,
        });
        const callback = new URL(result);

        assert.equal(callback.protocol, 'gredice-farm:');
        assert.equal(callback.hostname, 'auth-callback');
        assert.equal(callback.pathname, `/${provider}`);
        assert.equal(
            callback.searchParams.get('returnTo'),
            '/notifications?filter=unread#latest',
        );
    }
});

test('desktop OAuth keeps a bare callback when no return path is present', () => {
    assert.equal(
        desktopOAuthCallback({
            nestedRedirect: webOAuthCallback().toString(),
        }),
        'gredice-farm://auth-callback/google',
    );
    assert.equal(
        desktopOAuthCallback({ redirectValues: [] }),
        'gredice-farm://auth-callback/google',
    );
});

test('desktop OAuth omits return paths from untrusted nested callbacks', () => {
    const wrongOrigin = new URL(
        '/prijava/google-prijava/povratak?returnTo=%2Fnotifications',
        'https://attacker.example',
    );
    const wrongPath = new URL(
        '/prijava/facebook-prijava/povratak?returnTo=%2Fnotifications',
        farmOrigin,
    );
    const withHash = webOAuthCallback();
    withHash.searchParams.set('returnTo', '/notifications');
    withHash.hash = 'unexpected';
    const withExtraQuery = webOAuthCallback();
    withExtraQuery.searchParams.set('returnTo', '/notifications');
    withExtraQuery.searchParams.set('token', 'raw');
    const withCredentials = new URL(webOAuthCallback());
    withCredentials.username = 'user';
    const withDuplicateReturnTo = webOAuthCallback();
    withDuplicateReturnTo.searchParams.append('returnTo', '/notifications');
    withDuplicateReturnTo.searchParams.append('returnTo', '/schedule');
    const oversizedReturnTo = webOAuthCallback();
    oversizedReturnTo.searchParams.set('returnTo', `/${'a'.repeat(2_048)}`);

    for (const nestedRedirect of [
        wrongOrigin,
        wrongPath,
        withHash,
        withExtraQuery,
        withCredentials,
        withDuplicateReturnTo,
        oversizedReturnTo,
    ]) {
        assert.equal(
            desktopOAuthCallback({ nestedRedirect: nestedRedirect.toString() }),
            'gredice-farm://auth-callback/google',
        );
    }

    const validCallback = webOAuthCallback().toString();
    assert.equal(
        desktopOAuthCallback({
            redirectValues: [validCallback, validCallback],
        }),
        'gredice-farm://auth-callback/google',
    );
});

test('desktop release workflows can sign macOS artifacts when credentials exist', () => {
    const packageSource = fs.readFileSync(
        resolve(repoRoot, 'apps/desktop/scripts/package-desktop-app.mjs'),
        'utf8',
    );
    const prepareSigningSource = fs.readFileSync(
        resolve(repoRoot, 'apps/desktop/scripts/prepare-macos-signing-env.mjs'),
        'utf8',
    );
    const workflowSources = [
        '.github/workflows/desktop-release-app.yml',
        '.github/workflows/desktop-release-farm.yml',
        '.github/workflows/desktop-release-garden.yml',
    ].map((workflowPath) =>
        fs.readFileSync(resolve(repoRoot, workflowPath), 'utf8'),
    );

    assert.match(packageSource, /forceCodeSigning:/);
    assert.match(packageSource, /GREDICE_DESKTOP_REQUIRE_MAC_SIGNING/);
    assert.match(packageSource, /GREDICE_DESKTOP_SKIP_MAC_NOTARIZATION/);
    assert.match(packageSource, /withoutEmptySigningEnv/);
    assert.match(packageSource, /delete nextEnv\[name\]/);
    assert.match(prepareSigningSource, /CSC_LINK is not configured/);
    assert.match(prepareSigningSource, /ad-hoc signing/);
    assert.match(prepareSigningSource, /APPLE_API_KEY_CONTENT/);
    assert.match(prepareSigningSource, /APPLE_APP_SPECIFIC_PASSWORD/);
    assert.match(prepareSigningSource, /APPLE_KEYCHAIN_PROFILE/);
    assert.match(prepareSigningSource, /GREDICE_DESKTOP_SKIP_MAC_NOTARIZATION/);

    for (const workflowSource of workflowSources) {
        assert.match(workflowSource, /Prepare macOS signing and notarization/);
        assert.match(
            workflowSource,
            /node scripts\/prepare-macos-signing-env\.mjs/,
        );
        assert.doesNotMatch(
            workflowSource,
            /GREDICE_DESKTOP_REQUIRE_MAC_SIGNING/,
        );
        assert.doesNotMatch(workflowSource, /CSC_IDENTITY_AUTO_DISCOVERY/);
    }
});

test('desktop shell sets app identity before creating the macOS menu', () => {
    const mainSource = fs.readFileSync(
        resolve(repoRoot, 'apps/desktop/electron/main.cjs'),
        'utf8',
    );
    const setNameIndex = mainSource.indexOf(
        'app.setName(runtimeConfig.productName)',
    );
    const singleInstanceIndex = mainSource.indexOf(
        'app.requestSingleInstanceLock()',
    );
    const menuIndex = mainSource.lastIndexOf('createApplicationMenu();');

    assert.ok(setNameIndex >= 0);
    assert.ok(singleInstanceIndex >= 0);
    assert.ok(menuIndex >= 0);
    assert.ok(setNameIndex < singleInstanceIndex);
    assert.ok(setNameIndex < menuIndex);
    assert.match(mainSource, /page-title-updated/);
    assert.match(
        mainSource,
        /mainWindow\.setTitle\(runtimeConfig\.productName\)/,
    );
});

test('desktop dev starts the selected app and API locally', () => {
    const devScript = fs.readFileSync(
        resolve(repoRoot, 'apps/desktop/scripts/run-desktop-app.mjs'),
        'utf8',
    );

    assert.match(devScript, /const registryApiApp = getAppByName\('api'\)/);
    assert.match(devScript, /ensureDevServer\(registryApiApp, localApiUrl\)/);
    assert.match(devScript, /ensureDevServer\(registryApp, localUrl\)/);
    assert.match(
        devScript,
        /pnpmInvocation\(\['--filter', app\.name, 'dev'\]\)/,
    );
    assert.match(devScript, /ensureMacDevElectronApp/);
    assert.match(devScript, /CFBundleDisplayName/);
    assert.match(devScript, /CFBundleExecutable/);
    assert.match(devScript, /Contents\/MacOS\/Electron/);
    assert.match(
        devScript,
        /setPlistValue\(plistPath, 'CFBundleExecutable', 'Electron'\)/,
    );
    assert.match(devScript, /runCommand\('ditto'/);
    assert.doesNotMatch(devScript, /codesign/);
    assert.match(devScript, /GREDICE_DESKTOP_DEV: '1'/);
    assert.match(devScript, /url: localUrl/);
    assert.doesNotMatch(devScript, /Falling back to/);
});
