export type AppName =
    | 'www'
    | 'garden'
    | 'farm'
    | 'app'
    | 'storybook'
    | 'api'
    | 'status';

export type AppRegistryEntry = {
    name: AppName;
    packagePath: `apps/${AppName}`;
    localDomain: `${string}.gredice.test`;
    devPort: number;
    startPort: number;
    testPort: number;
    componentTestPort: number | null;
    vercelProjectName: string;
    startsInDefaultDev: boolean;
};

export const appRegistry: AppRegistryEntry[] = [
    {
        name: 'www',
        packagePath: 'apps/www',
        localDomain: 'www.gredice.test',
        devPort: 3000,
        startPort: 3000,
        testPort: 3000,
        componentTestPort: 3100,
        vercelProjectName: 'www',
        startsInDefaultDev: true,
    },
    {
        name: 'garden',
        packagePath: 'apps/garden',
        localDomain: 'vrt.gredice.test',
        devPort: 3001,
        startPort: 3001,
        testPort: 3001,
        componentTestPort: 3101,
        vercelProjectName: 'garden',
        startsInDefaultDev: true,
    },
    {
        name: 'farm',
        packagePath: 'apps/farm',
        localDomain: 'farma.gredice.test',
        devPort: 3002,
        startPort: 3002,
        testPort: 3002,
        componentTestPort: 3102,
        vercelProjectName: 'farm',
        startsInDefaultDev: true,
    },
    {
        name: 'app',
        packagePath: 'apps/app',
        localDomain: 'app.gredice.test',
        devPort: 3003,
        startPort: 3003,
        testPort: 3003,
        componentTestPort: 3103,
        vercelProjectName: 'app',
        startsInDefaultDev: true,
    },
    {
        name: 'storybook',
        packagePath: 'apps/storybook',
        localDomain: 'storybook.dev.gredice.test',
        devPort: 3004,
        startPort: 3004,
        testPort: 3004,
        componentTestPort: null,
        vercelProjectName: 'storybook',
        startsInDefaultDev: true,
    },
    {
        name: 'api',
        packagePath: 'apps/api',
        localDomain: 'api.gredice.test',
        devPort: 3005,
        startPort: 3005,
        testPort: 3005,
        componentTestPort: null,
        vercelProjectName: 'api',
        startsInDefaultDev: true,
    },
    {
        name: 'status',
        packagePath: 'apps/status',
        localDomain: 'status.gredice.test',
        devPort: 3006,
        startPort: 3006,
        testPort: 3006,
        componentTestPort: null,
        vercelProjectName: 'status',
        startsInDefaultDev: false,
    },
];

export function getAppByName(appName: AppName) {
    const app = appRegistry.find((candidate) => candidate.name === appName);
    if (!app) {
        throw new Error(`Unknown Gredice app: ${appName}`);
    }

    return app;
}

export function getAppByPackagePath(packagePath: string) {
    return appRegistry.find(
        (candidate) => candidate.packagePath === packagePath,
    );
}

export function localAppHostnameUrl(
    app: AppRegistryEntry,
    hostname: string,
    port = app.testPort,
) {
    return `http://${hostname}:${port}`;
}

export function localAppUrl(app: AppRegistryEntry, port = app.testPort) {
    return localAppHostnameUrl(app, '127.0.0.1', port);
}

function parsePortOverride(value: string | undefined, fallback: number) {
    if (!value) {
        return fallback;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 65_535) {
        throw new Error(`Invalid port override: ${value}`);
    }

    return parsed;
}

export function getAppTestPort(app: AppRegistryEntry) {
    const appKey = app.name.toUpperCase();
    return parsePortOverride(
        process.env[`GREDICE_${appKey}_TEST_PORT`] ?? process.env.GREDICE_TEST_PORT,
        app.testPort,
    );
}

export function getPlaywrightBaseUrl(app: AppRegistryEntry) {
    const appKey = app.name.toUpperCase();
    const override = process.env[`GREDICE_${appKey}_BASE_URL`] ?? process.env.GREDICE_TEST_BASE_URL;
    if (override) {
        return override;
    }

    return localAppUrl(app, getAppTestPort(app));
}

export function getComponentTestPort(app: AppRegistryEntry) {
    if (app.componentTestPort === null) {
        throw new Error(`${app.name} does not define a component test port.`);
    }

    const appKey = app.name.toUpperCase();
    return parsePortOverride(
        process.env[`GREDICE_${appKey}_CT_PORT`] ?? process.env.GREDICE_CT_PORT,
        app.componentTestPort,
    );
}

export function shouldReusePlaywrightServer() {
    return process.env.CI ? false : process.env.GREDICE_PLAYWRIGHT_REUSE_SERVER === 'true';
}
