#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildRuntimeConfig,
    desktopAppNames,
    getDesktopApp,
} from './desktop-apps.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(scriptDir, '..');
const repoRoot = resolve(desktopRoot, '../..');
const targetName = process.argv[2];
const args = process.argv.slice(3);
const shouldBuildDirectory = args.includes('--dir');
const shouldBuildMac = args.includes('--mac');
const shouldBuildWindows = args.includes('--win') || args.includes('--windows');
const shouldBuildAllPlatforms = args.includes('--all-platforms');
const passthroughBuilderArgs = args.filter((arg) =>
    ['--arm64', '--ia32', '--universal', '--x64'].includes(arg),
);

if (!targetName) {
    throw new Error(
        `Missing desktop app name. Expected one of: all, ${desktopAppNames.join(', ')}`,
    );
}

const appsToBuild =
    targetName === 'all'
        ? desktopAppNames
        : [getDesktopApp(targetName).appName];
const signingEnvNames = [
    'CSC_INSTALLER_KEY_PASSWORD',
    'CSC_INSTALLER_LINK',
    'CSC_KEY_PASSWORD',
    'CSC_LINK',
    'CSC_NAME',
];

function selectedPlatformArgs() {
    if (shouldBuildAllPlatforms) {
        return ['--mac', '--win'];
    }

    const platformArgs = [];
    if (shouldBuildMac) {
        platformArgs.push('--mac');
    }

    if (shouldBuildWindows) {
        platformArgs.push('--win');
    }

    if (platformArgs.length > 0) {
        return platformArgs;
    }

    if (process.platform === 'darwin') {
        return ['--mac'];
    }

    if (process.platform === 'win32') {
        return ['--win'];
    }

    throw new Error('Specify --mac or --win when building from this platform.');
}

function withoutEmptySigningEnv(env) {
    const nextEnv = { ...env };

    for (const name of signingEnvNames) {
        if ((nextEnv[name] ?? '').trim().length === 0) {
            delete nextEnv[name];
        }
    }

    return nextEnv;
}

async function readPackageJson(packagePath) {
    const rawPackage = await fs.readFile(
        resolve(repoRoot, packagePath),
        'utf8',
    );
    return JSON.parse(rawPackage);
}

async function copyDesktopShellFiles(stageDir, desktopApp) {
    await fs.rm(stageDir, { force: true, recursive: true });
    await fs.mkdir(stageDir, { recursive: true });
    await fs.copyFile(
        resolve(desktopRoot, 'electron/main.cjs'),
        resolve(stageDir, 'main.cjs'),
    );
    await fs.copyFile(
        resolve(desktopRoot, 'electron/preload.cjs'),
        resolve(stageDir, 'preload.cjs'),
    );
    await fs.copyFile(
        resolve(repoRoot, desktopApp.iconPath),
        resolve(stageDir, 'icon.png'),
    );
    await fs.copyFile(
        resolve(repoRoot, desktopApp.faviconPath),
        resolve(stageDir, 'favicon.ico'),
    );
}

async function writeRuntimeConfig(stageDir, desktopApp) {
    const runtimeConfig = buildRuntimeConfig(desktopApp);
    await fs.writeFile(
        resolve(stageDir, 'desktop-app.json'),
        `${JSON.stringify(runtimeConfig, null, 4)}\n`,
    );
}

async function writeStagePackageJson(stageDir, desktopApp, sourcePackage) {
    const releaseVersion =
        process.env.GREDICE_DESKTOP_VERSION ?? sourcePackage.version ?? '0.0.0';
    const stagePackage = {
        name: `gredice-${desktopApp.appName}-desktop`,
        version: releaseVersion,
        private: true,
        author: 'Gredice',
        description: desktopApp.description,
        main: 'main.cjs',
    };

    await fs.writeFile(
        resolve(stageDir, 'package.json'),
        `${JSON.stringify(stagePackage, null, 4)}\n`,
    );
}

async function writeEntitlements(stageDir) {
    const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.device.camera</key>
    <true/>
    <key>com.apple.security.device.microphone</key>
    <true/>
</dict>
</plist>
`;

    await fs.writeFile(
        resolve(stageDir, 'entitlements.mac.plist'),
        entitlements,
    );
}

async function writeBuilderConfig(stageDir, desktopApp, electronVersion) {
    const outputDir = resolve(desktopRoot, 'dist', desktopApp.appName);
    const entitlementsPath = resolve(stageDir, 'entitlements.mac.plist');
    const builderConfig = {
        appId: desktopApp.appId,
        productName: desktopApp.productName,
        // biome-ignore lint/suspicious/noTemplateCurlyInString: Electron Builder expands artifact macros.
        artifactName: '${productName}-${version}-${os}-${arch}.${ext}',
        asar: true,
        compression: 'normal',
        directories: {
            buildResources: '.',
            output: outputDir,
        },
        electronVersion,
        forceCodeSigning:
            process.env.GREDICE_DESKTOP_REQUIRE_MAC_SIGNING === '1',
        files: [
            'desktop-app.json',
            'favicon.ico',
            'icon.png',
            'main.cjs',
            'package.json',
            'preload.cjs',
        ],
        mac: {
            category: 'public.app-category.business',
            entitlements: entitlementsPath,
            entitlementsInherit: entitlementsPath,
            extendInfo: {
                NSCameraUsageDescription:
                    'Gredice uses the camera when an app workflow requests barcode scanning or media capture.',
                NSLocationWhenInUseUsageDescription:
                    'Gredice uses location only when an app workflow requests it.',
                NSMicrophoneUsageDescription:
                    'Gredice uses the microphone only when an app workflow requests media capture.',
            },
            gatekeeperAssess: false,
            hardenedRuntime: true,
            icon: 'icon.png',
            notarize:
                process.env.GREDICE_DESKTOP_SKIP_MAC_NOTARIZATION === '1'
                    ? false
                    : undefined,
            target: ['dmg', 'zip'],
        },
        dmg: {
            icon: 'icon.png',
            iconSize: 100,
            window: {
                width: 540,
                height: 380,
            },
            contents: [
                {
                    x: 140,
                    y: 220,
                    type: 'file',
                },
                {
                    x: 400,
                    y: 220,
                    type: 'link',
                    path: '/Applications',
                },
            ],
        },
        nsis: {
            allowToChangeInstallationDirectory: true,
            installerIcon: 'favicon.ico',
            oneClick: false,
            perMachine: false,
            uninstallerIcon: 'favicon.ico',
        },
        protocols: [
            {
                name: desktopApp.productName,
                schemes: [desktopApp.protocol],
            },
        ],
        publish: null,
        win: {
            icon: 'favicon.ico',
            requestedExecutionLevel: 'asInvoker',
            target: [
                {
                    arch: ['x64'],
                    target: 'nsis',
                },
                {
                    arch: ['x64'],
                    target: 'portable',
                },
            ],
        },
    };

    await fs.writeFile(
        resolve(stageDir, 'electron-builder.json'),
        `${JSON.stringify(builderConfig, null, 4)}\n`,
    );
}

function runElectronBuilder(stageDir, desktopApp) {
    const electronBuilderCommand = resolve(
        desktopRoot,
        'node_modules/.bin',
        process.platform === 'win32'
            ? 'electron-builder.cmd'
            : 'electron-builder',
    );
    const builderArgs = [
        '--projectDir',
        stageDir,
        '--config',
        resolve(stageDir, 'electron-builder.json'),
        '--publish',
        'never',
        ...selectedPlatformArgs(),
        ...passthroughBuilderArgs,
        ...(shouldBuildDirectory ? ['--dir'] : []),
    ];

    console.log(`Packaging ${desktopApp.productName}...`);
    console.log(`electron-builder ${builderArgs.join(' ')}`);

    return new Promise((resolveBuild, rejectBuild) => {
        const child = spawn(electronBuilderCommand, builderArgs, {
            cwd: repoRoot,
            env: withoutEmptySigningEnv(process.env),
            shell: process.platform === 'win32',
            stdio: 'inherit',
        });

        child.on('error', (error) => {
            rejectBuild(error);
        });

        child.on('exit', (code) => {
            if (code === 0) {
                resolveBuild();
                return;
            }

            rejectBuild(
                new Error(
                    `electron-builder failed for ${desktopApp.appName} with exit code ${code}.`,
                ),
            );
        });
    });
}

for (const appName of appsToBuild) {
    const desktopApp = getDesktopApp(appName);
    const stageDir = resolve(desktopRoot, '.desktop-build', appName);
    const desktopPackage = await readPackageJson('apps/desktop/package.json');
    const sourcePackage = await readPackageJson(
        `${desktopApp.packagePath}/package.json`,
    );

    await copyDesktopShellFiles(stageDir, desktopApp);
    await writeRuntimeConfig(stageDir, desktopApp);
    await writeStagePackageJson(stageDir, desktopApp, sourcePackage);
    await writeEntitlements(stageDir);
    await writeBuilderConfig(
        stageDir,
        desktopApp,
        desktopPackage.devDependencies.electron,
    );
    await runElectronBuilder(stageDir, desktopApp);
}
