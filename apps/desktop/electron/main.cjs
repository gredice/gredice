const { app, BrowserWindow, Menu, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const allowedPermissionNames = new Set([
    'clipboard-read',
    'clipboard-sanitized-write',
    'fullscreen',
    'geolocation',
    'media',
    'notifications',
]);

const allowedExternalProtocols = new Set(['https:', 'mailto:', 'tel:']);
const oauthProviders = new Set(['facebook', 'google']);

let mainWindow = null;
let pendingAuthCallbackUrl = null;
let runtimeConfig = null;
let trustedNavigationOrigins = new Set();
let trustedPermissionOrigins = new Set();

const desktopShellStyles = `
:root {
    --gredice-desktop-shell: 1;
}

:where(a[href='https://www.gredice.com'], a[href='https://www.gredice.com/'])
    > svg[viewBox='0 0 163 44'] {
    display: none !important;
}
`;

const macosGlassStyles = `
html,
body {
    background: transparent !important;
}

:root {
    --gredice-desktop-titlebar-height: 52px;
    --gredice-desktop-glass-background: color-mix(
        in srgb,
        hsl(var(--background, 0 0% 100%)) 62%,
        transparent
    );
    --gredice-desktop-glass-muted: color-mix(
        in srgb,
        hsl(var(--muted, var(--background, 0 0% 100%))) 68%,
        transparent
    );
    --gredice-desktop-glass-secondary: color-mix(
        in srgb,
        hsl(var(--secondary, var(--background, 0 0% 100%))) 70%,
        transparent
    );
}

body {
    background-color: color-mix(
        in srgb,
        hsl(var(--background, 0 0% 100%)) 58%,
        transparent
    ) !important;
    box-sizing: border-box;
    min-height: 100vh;
    padding-top: var(--gredice-desktop-titlebar-height) !important;
}

body::before {
    -webkit-app-region: drag;
    -webkit-backdrop-filter: saturate(180%) blur(28px);
    backdrop-filter: saturate(180%) blur(28px);
    background: color-mix(
        in srgb,
        hsl(var(--background, 0 0% 100%)) 34%,
        transparent
    );
    border-bottom: 1px solid color-mix(in srgb, currentColor 10%, transparent);
    content: "";
    height: var(--gredice-desktop-titlebar-height);
    left: 0;
    pointer-events: auto;
    position: fixed;
    right: 0;
    top: 0;
    z-index: 2147483647;
}

button,
input,
select,
textarea,
a,
[contenteditable='true'],
[role='button'],
[role='link'],
[role='menuitem'],
[role='tab'] {
    -webkit-app-region: no-drag;
}

:where(.bg-background, .bg-muted, .bg-secondary, .bg-accent, .bg-tertiary):not(
        :where(
                .bg-card,
                .bg-popover,
                button,
                input,
                select,
                textarea,
                [role='button'],
                [role='dialog']
            )
    ) {
    background-color: var(--gredice-desktop-glass-background) !important;
    -webkit-backdrop-filter: saturate(180%) blur(28px);
    backdrop-filter: saturate(180%) blur(28px);
}

:where(.bg-muted, .bg-accent, .bg-tertiary):not(
        :where(
                .bg-card,
                .bg-popover,
                button,
                input,
                select,
                textarea,
                [role='button'],
                [role='dialog']
            )
    ) {
    background-color: var(--gredice-desktop-glass-muted) !important;
}

:where(.bg-secondary):not(
        :where(
                .bg-card,
                .bg-popover,
                button,
                input,
                select,
                textarea,
                [role='button'],
                [role='dialog']
            )
    ) {
    background-color: var(--gredice-desktop-glass-secondary) !important;
}
`;

const macosAdminGlassStyles = `
body:has([data-gredice-admin-shell]) {
    background-color: color-mix(
        in srgb,
        hsl(var(--background, 0 0% 100%)) 24%,
        transparent
    ) !important;
    padding-top: 0 !important;
}

body:has([data-gredice-admin-shell])::before {
    display: none !important;
}

:where([data-gredice-admin-shell], [data-gredice-admin-frame]) {
    background: transparent !important;
}

[data-gredice-admin-frame] {
    min-height: 100vh;
}

[data-gredice-admin-nav-panel] {
    -webkit-app-region: drag;
    -webkit-backdrop-filter: saturate(180%) blur(30px);
    backdrop-filter: saturate(180%) blur(30px);
    background-color: color-mix(
        in srgb,
        hsl(var(--background, 0 0% 100%)) 34%,
        transparent
    ) !important;
    border-color: color-mix(in srgb, currentColor 12%, transparent) !important;
    padding-top: 2.75rem !important;
}

[data-gredice-admin-nav-panel] :where(a, button, [role='button']) {
    -webkit-app-region: no-drag;
}

[data-gredice-admin-nav-panel] :where(.bg-muted) {
    background-color: color-mix(
        in srgb,
        hsl(var(--muted, var(--background, 0 0% 100%))) 38%,
        transparent
    ) !important;
}

[data-gredice-admin-content-panel] {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background-color: var(
        --admin-page-content-background,
        hsl(var(--background, 0 0% 100%))
    ) !important;
    background-clip: padding-box;
    border-color: color-mix(in srgb, currentColor 14%, transparent) !important;
}

[data-gredice-admin-content-panel]
    :where(.bg-card, [class*='bg-card'], [role='dialog']) {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
}

@media (min-width: 768px) {
    [data-gredice-admin-nav-panel] {
        top: 1rem !important;
        max-height: calc(100vh - 2rem) !important;
    }

    [data-gredice-admin-content-panel] {
        min-height: calc(100vh - 2rem) !important;
    }
}
`;

function readJsonFile(filePath) {
    const rawConfig = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawConfig);
}

function resolveConfigPath() {
    if (process.env.GREDICE_DESKTOP_CONFIG?.trim()) {
        return process.env.GREDICE_DESKTOP_CONFIG.trim();
    }

    return path.join(__dirname, 'desktop-app.json');
}

function isLoopbackHost(hostname) {
    return (
        hostname === '127.0.0.1' ||
        hostname === 'localhost' ||
        hostname === '::1' ||
        hostname === '[::1]'
    );
}

function isDesktopDevMode() {
    return process.env.GREDICE_DESKTOP_DEV === '1' || !app.isPackaged;
}

function normalizeUrl(value) {
    const parsedUrl = new URL(value);

    if (parsedUrl.protocol !== 'https:') {
        const isAllowedDevUrl =
            isDesktopDevMode() &&
            parsedUrl.protocol === 'http:' &&
            isLoopbackHost(parsedUrl.hostname);

        if (!isAllowedDevUrl) {
            throw new Error(`Desktop app URLs must use HTTPS: ${value}`);
        }
    }

    return parsedUrl;
}

function originForUrl(value) {
    return normalizeUrl(value).origin;
}

function safeOriginForUrl(value) {
    try {
        return originForUrl(value);
    } catch (_error) {
        return null;
    }
}

function readRuntimeConfig() {
    const configPath = resolveConfigPath();
    if (!fs.existsSync(configPath)) {
        throw new Error(`Missing desktop app config: ${configPath}`);
    }

    const config = readJsonFile(configPath);
    const envUrl = process.env.GREDICE_DESKTOP_URL?.trim();
    const allowPackagedUrlOverride =
        process.env.GREDICE_DESKTOP_ALLOW_URL_OVERRIDE === '1';
    const url =
        envUrl && (isDesktopDevMode() || allowPackagedUrlOverride)
            ? envUrl
            : config.url;

    if (!url) {
        throw new Error('Desktop app config must include a url.');
    }

    const externalAuthBaseUrl =
        process.env.GREDICE_DESKTOP_EXTERNAL_AUTH_BASE_URL?.trim() ||
        config.externalAuthBaseUrl ||
        'https://api.gredice.com';

    return {
        appId: config.appId,
        appName: config.appName,
        externalAuthBaseUrl,
        productName: config.productName ?? 'Gredice',
        protocol: config.protocol,
        trustedNavigationOrigins: config.trustedNavigationOrigins ?? [],
        url,
        window: config.window ?? {},
    };
}

function parseTrustedOrigins(config) {
    return new Set(
        [config.url, ...config.trustedNavigationOrigins].map((origin) =>
            originForUrl(origin),
        ),
    );
}

function parseTrustedPermissionOrigins(config) {
    return new Set([originForUrl(config.url)]);
}

function canNavigateInApp(targetUrl) {
    try {
        const parsedUrl = new URL(targetUrl);
        if (parsedUrl.protocol === 'about:') {
            return true;
        }

        if (
            parsedUrl.protocol === 'http:' &&
            isLoopbackHost(parsedUrl.hostname)
        ) {
            return (
                isDesktopDevMode() &&
                trustedNavigationOrigins.has(parsedUrl.origin)
            );
        }

        return (
            parsedUrl.protocol === 'https:' &&
            trustedNavigationOrigins.has(parsedUrl.origin)
        );
    } catch (_error) {
        return false;
    }
}

function canOpenExternally(targetUrl) {
    try {
        const parsedUrl = new URL(targetUrl);
        return allowedExternalProtocols.has(parsedUrl.protocol);
    } catch (_error) {
        return false;
    }
}

function providerFromAuthPath(pathname) {
    const match = pathname.match(
        /^\/(?:api\/auth|api\/gredice\/api\/auth)\/(facebook|google)$/,
    );
    return match?.[1] ?? null;
}

function authCallbackPath(provider) {
    if (provider === 'facebook') {
        return '/prijava/facebook-prijava/povratak';
    }

    return '/prijava/google-prijava/povratak';
}

function isTrustedAuthOrigin(parsedUrl) {
    return (
        trustedNavigationOrigins.has(parsedUrl.origin) ||
        originForUrl(runtimeConfig.externalAuthBaseUrl) === parsedUrl.origin
    );
}

function desktopAuthCallbackRedirectUrl(provider) {
    if (!runtimeConfig.protocol) {
        return null;
    }

    return `${runtimeConfig.protocol}://auth-callback/${provider}`;
}

function openExternalOAuthLogin(targetUrl) {
    try {
        const parsedUrl = new URL(targetUrl);
        const provider = providerFromAuthPath(parsedUrl.pathname);
        if (!provider || !isTrustedAuthOrigin(parsedUrl)) {
            return false;
        }

        const redirectUrl = desktopAuthCallbackRedirectUrl(provider);
        if (!redirectUrl) {
            return false;
        }

        const externalAuthUrl = new URL(
            `/api/auth/${provider}`,
            runtimeConfig.externalAuthBaseUrl,
        );
        const timeZone = parsedUrl.searchParams.get('timeZone');
        if (timeZone) {
            externalAuthUrl.searchParams.set('timeZone', timeZone);
        }
        externalAuthUrl.searchParams.set('redirect', redirectUrl);

        void shell.openExternal(externalAuthUrl.toString());
        return true;
    } catch (error) {
        console.warn('Unable to open external OAuth login.', error);
        return false;
    }
}

function openExternal(targetUrl) {
    if (canOpenExternally(targetUrl)) {
        void shell.openExternal(targetUrl);
    }
}

function parseDesktopAuthCallbackUrl(targetUrl) {
    if (!runtimeConfig?.protocol) {
        return null;
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const expectedProtocol = `${runtimeConfig.protocol}:`;
        if (
            parsedUrl.protocol !== expectedProtocol ||
            parsedUrl.hostname !== 'auth-callback'
        ) {
            return null;
        }

        const provider = parsedUrl.pathname.replace(/^\/+/, '').split('/')[0];
        if (!oauthProviders.has(provider)) {
            return null;
        }

        return {
            provider,
            search: parsedUrl.search,
            hash: parsedUrl.hash,
        };
    } catch (_error) {
        return null;
    }
}

function findDesktopAuthCallbackUrl(argv) {
    return argv.find((argument) => parseDesktopAuthCallbackUrl(argument));
}

function handleDesktopAuthCallbackUrl(targetUrl) {
    const callback = parseDesktopAuthCallbackUrl(targetUrl);
    if (!callback) {
        return false;
    }

    const callbackUrl = new URL(
        authCallbackPath(callback.provider),
        runtimeConfig.url,
    );
    callbackUrl.search = callback.search;
    callbackUrl.hash = callback.hash;
    pendingAuthCallbackUrl = callbackUrl.toString();

    if (mainWindow && !mainWindow.isDestroyed()) {
        void mainWindow.loadURL(pendingAuthCallbackUrl);
        pendingAuthCallbackUrl = null;

        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }

        mainWindow.focus();
    }

    return true;
}

function registerProtocolClient() {
    if (!runtimeConfig.protocol) {
        return;
    }

    if (!isDesktopDevMode()) {
        app.setAsDefaultProtocolClient(runtimeConfig.protocol);
        return;
    }

    app.setAsDefaultProtocolClient(runtimeConfig.protocol, process.execPath, [
        path.join(__dirname, 'main.cjs'),
    ]);
}

function configureSessionPermissions() {
    session.defaultSession.setPermissionRequestHandler(
        (webContents, permission, callback, details) => {
            const requestingUrl =
                details?.requestingUrl || webContents.getURL();
            const requestingOrigin = safeOriginForUrl(requestingUrl);
            const isTrustedOrigin =
                requestingOrigin !== null &&
                trustedPermissionOrigins.has(requestingOrigin);

            callback(isTrustedOrigin && allowedPermissionNames.has(permission));
        },
    );
}

function configureWebContentsGuards() {
    app.on('web-contents-created', (_event, contents) => {
        contents.on('will-attach-webview', (event) => {
            event.preventDefault();
        });

        contents.on('will-navigate', (event, targetUrl) => {
            if (openExternalOAuthLogin(targetUrl)) {
                event.preventDefault();
                return;
            }

            if (canNavigateInApp(targetUrl)) {
                return;
            }

            event.preventDefault();
            openExternal(targetUrl);
        });
    });
}

function createApplicationMenu() {
    const template = [
        ...(process.platform === 'darwin'
            ? [
                  {
                      label: runtimeConfig.productName,
                      submenu: [
                          { role: 'about' },
                          { type: 'separator' },
                          { role: 'services' },
                          { type: 'separator' },
                          { role: 'hide' },
                          { role: 'hideOthers' },
                          { role: 'unhide' },
                          { type: 'separator' },
                          { role: 'quit' },
                      ],
                  },
              ]
            : []),
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
            ],
        },
        {
            label: 'Window',
            submenu: [
                { role: 'close' },
                { role: 'minimize' },
                { role: 'zoom' },
                ...(process.platform === 'darwin'
                    ? [{ type: 'separator' }, { role: 'front' }]
                    : []),
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function macosGlassWindowOptions() {
    if (process.platform !== 'darwin') {
        return {};
    }

    const trafficLightPosition =
        runtimeConfig.appName === 'app' ? { x: 32, y: 32 } : { x: 18, y: 18 };

    return {
        backgroundColor: '#00000000',
        titleBarStyle: 'hiddenInset',
        transparent: true,
        trafficLightPosition,
        vibrancy: 'under-window',
        visualEffectState: 'active',
    };
}

async function insertDesktopCSS(contents, styles, warningMessage) {
    if (contents.isDestroyed()) {
        return;
    }

    try {
        await contents.insertCSS(styles, { cssOrigin: 'author' });
    } catch (error) {
        console.warn(warningMessage, error);
    }
}

async function injectDesktopStyles(contents) {
    await insertDesktopCSS(
        contents,
        desktopShellStyles,
        'Unable to inject desktop shell styles.',
    );

    if (process.platform !== 'darwin') {
        return;
    }

    await insertDesktopCSS(
        contents,
        macosGlassStyles,
        'Unable to inject macOS glass desktop styles.',
    );

    if (runtimeConfig.appName === 'app') {
        await insertDesktopCSS(
            contents,
            macosAdminGlassStyles,
            'Unable to inject macOS admin glass desktop styles.',
        );
    }
}

function createMainWindow() {
    const preloadPath = path.join(__dirname, 'preload.cjs');
    const iconPath = path.join(__dirname, 'icon.png');
    const windowOptions = runtimeConfig.window;
    const glassWindowOptions = macosGlassWindowOptions();

    if (process.platform === 'darwin' && app.dock && fs.existsSync(iconPath)) {
        app.dock.setIcon(iconPath);
    }

    mainWindow = new BrowserWindow({
        backgroundColor: '#0f1412',
        height: windowOptions.height ?? 900,
        icon: fs.existsSync(iconPath) ? iconPath : undefined,
        minHeight: windowOptions.minHeight ?? 680,
        minWidth: windowOptions.minWidth ?? 1024,
        show: false,
        title: runtimeConfig.productName,
        webPreferences: {
            contextIsolation: true,
            devTools:
                isDesktopDevMode() ||
                process.env.GREDICE_DESKTOP_DEVTOOLS === '1',
            nodeIntegration: false,
            preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
            sandbox: true,
            webSecurity: true,
        },
        width: windowOptions.width ?? 1440,
        ...glassWindowOptions,
    });

    if (
        process.platform === 'darwin' &&
        typeof mainWindow.setWindowButtonVisibility === 'function'
    ) {
        mainWindow.setWindowButtonVisibility(true);
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.on('page-title-updated', (event) => {
        event.preventDefault();
        mainWindow.setTitle(runtimeConfig.productName);
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (openExternalOAuthLogin(url)) {
            return { action: 'deny' };
        }

        if (canNavigateInApp(url)) {
            void mainWindow.loadURL(url);
        } else {
            openExternal(url);
        }

        return { action: 'deny' };
    });

    mainWindow.webContents.on('dom-ready', () => {
        void injectDesktopStyles(mainWindow.webContents);
    });

    const initialUrl = pendingAuthCallbackUrl ?? runtimeConfig.url;
    pendingAuthCallbackUrl = null;
    void mainWindow.loadURL(initialUrl);
}

try {
    runtimeConfig = readRuntimeConfig();
    app.setName(runtimeConfig.productName);
    app.setAboutPanelOptions({
        applicationName: runtimeConfig.productName,
    });
    process.title = runtimeConfig.productName;
    registerProtocolClient();
    const initialAuthCallbackUrl = findDesktopAuthCallbackUrl(process.argv);
    if (initialAuthCallbackUrl) {
        handleDesktopAuthCallbackUrl(initialAuthCallbackUrl);
    }
} catch (error) {
    console.error(error);
    app.quit();
    process.exit(1);
}

app.on('open-url', (event, targetUrl) => {
    event.preventDefault();
    handleDesktopAuthCallbackUrl(targetUrl);
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
    app.quit();
} else {
    app.on('second-instance', (_event, commandLine) => {
        const authCallbackUrl = findDesktopAuthCallbackUrl(commandLine);
        if (authCallbackUrl) {
            handleDesktopAuthCallbackUrl(authCallbackUrl);
        }

        if (!mainWindow) {
            return;
        }

        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }

        mainWindow.focus();
    });

    app.whenReady()
        .then(() => {
            trustedNavigationOrigins = parseTrustedOrigins(runtimeConfig);
            trustedPermissionOrigins =
                parseTrustedPermissionOrigins(runtimeConfig);
            app.setAppUserModelId(runtimeConfig.appId);
            app.setName(runtimeConfig.productName);
            configureSessionPermissions();
            configureWebContentsGuards();
            createApplicationMenu();
            createMainWindow();
        })
        .catch((error) => {
            console.error(error);
            app.quit();
        });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
}
