export const desktopApps = {
    garden: {
        appId: 'com.gredice.garden',
        appName: 'garden',
        description: 'Desktop shell for the Gredice customer garden app.',
        externalAuthBaseUrl: 'https://api.gredice.com',
        faviconPath: 'apps/garden/app/favicon.ico',
        iconPath: 'apps/garden/app/icon.png',
        packagePath: 'apps/garden',
        productName: 'Gredice Garden',
        protocol: 'gredice-garden',
        url: 'https://vrt.gredice.com',
        window: {
            height: 900,
            minHeight: 700,
            minWidth: 1024,
            width: 1440,
        },
    },
    farm: {
        appId: 'com.gredice.farm',
        appName: 'farm',
        description: 'Desktop shell for the Gredice farm back-office app.',
        externalAuthBaseUrl: 'https://api.gredice.com',
        faviconPath: 'apps/farm/app/favicon.ico',
        iconPath: 'apps/farm/app/icon.png',
        packagePath: 'apps/farm',
        productName: 'Gredice Farm',
        protocol: 'gredice-farm',
        url: 'https://farma.gredice.com',
        window: {
            height: 900,
            minHeight: 700,
            minWidth: 1100,
            width: 1440,
        },
    },
    app: {
        appId: 'com.gredice.admin',
        appName: 'app',
        description: 'Desktop shell for the Gredice internal admin app.',
        externalAuthBaseUrl: 'https://api.gredice.com',
        faviconPath: 'apps/app/app/favicon.ico',
        iconPath: 'apps/app/app/icon.png',
        packagePath: 'apps/app',
        productName: 'Gredice Admin',
        protocol: 'gredice-admin',
        url: 'https://app.gredice.com',
        window: {
            height: 900,
            minHeight: 700,
            minWidth: 1100,
            width: 1440,
        },
    },
};

export const desktopAppNames = Object.keys(desktopApps);

export const sharedTrustedNavigationOrigins = [
    'https://api.gredice.com',
    'https://accounts.google.com',
    'https://facebook.com',
    'https://www.facebook.com',
    'https://checkout.stripe.com',
];

export function getDesktopApp(appName) {
    const desktopApp = desktopApps[appName];
    if (!desktopApp) {
        throw new Error(
            `Unknown desktop app "${appName}". Expected one of: ${desktopAppNames.join(', ')}`,
        );
    }

    return desktopApp;
}

export function buildRuntimeConfig(desktopApp, overrides = {}) {
    return {
        appId: desktopApp.appId,
        appName: desktopApp.appName,
        externalAuthBaseUrl:
            overrides.externalAuthBaseUrl ?? desktopApp.externalAuthBaseUrl,
        productName: desktopApp.productName,
        protocol: desktopApp.protocol,
        trustedNavigationOrigins: [
            desktopApp.url,
            ...sharedTrustedNavigationOrigins,
            ...(overrides.trustedNavigationOrigins ?? []),
        ],
        url: overrides.url ?? desktopApp.url,
        window: desktopApp.window,
    };
}
