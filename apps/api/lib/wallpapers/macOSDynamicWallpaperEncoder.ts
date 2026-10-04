import 'server-only';
import { Sandbox } from '@vercel/sandbox';
import {
    addMacOSDynamicWallpaperXmp,
    hasMacOSDynamicWallpaperMetadata,
    type MacOSDynamicWallpaperPhase,
    macOSDynamicWallpaperPhases,
} from './macOSDynamicWallpaper';

const sandboxTimeoutMs = 4 * 60 * 1_000;
const sandboxDirectory = '/tmp/gredice-wallpaper';
const outputPath = `${sandboxDirectory}/gredice-dinamicka.heic`;

export class MacOSDynamicWallpaperEncodingError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MacOSDynamicWallpaperEncodingError';
    }
}

function sandboxSource() {
    const snapshotId = process.env.MACOS_WALLPAPER_SANDBOX_SNAPSHOT_ID;
    return snapshotId ? ({ type: 'snapshot', snapshotId } as const) : undefined;
}

async function commandError(result: {
    exitCode: number;
    stderr(): Promise<string>;
}) {
    const stderr = (await result.stderr()).trim();
    return stderr.length > 0 ? stderr.slice(-2_000) : 'Unknown encoder error';
}

export async function encodeMacOSDynamicWallpaper({
    frames,
}: {
    frames: ReadonlyMap<MacOSDynamicWallpaperPhase, Uint8Array>;
}) {
    const source = sandboxSource();
    const sandbox = await Sandbox.create({
        ...(source ? { source } : { runtime: 'node24' as const }),
        resources: { vcpus: 4 },
        timeout: sandboxTimeoutMs,
    });

    try {
        if (!source) {
            const install = await sandbox.runCommand({
                args: ['install', '-y', 'libheif-tools'],
                cmd: 'dnf',
                sudo: true,
            });
            if (install.exitCode !== 0) {
                throw new MacOSDynamicWallpaperEncodingError(
                    `HEIC encoder installation failed: ${await commandError(install)}`,
                );
            }
        }

        await sandbox.mkDir(sandboxDirectory);
        const inputPaths = macOSDynamicWallpaperPhases.map(
            (phase, index) =>
                `${sandboxDirectory}/${index.toString().padStart(2, '0')}-${phase}.png`,
        );
        await sandbox.writeFiles(
            macOSDynamicWallpaperPhases.map((phase, index) => {
                const frame = frames.get(phase);
                if (!frame) {
                    throw new MacOSDynamicWallpaperEncodingError(
                        `Missing wallpaper frame: ${phase}`,
                    );
                }
                return {
                    content:
                        index === 0
                            ? addMacOSDynamicWallpaperXmp(frame)
                            : frame,
                    path: inputPaths[index] ?? '',
                };
            }),
        );

        const encode = await sandbox.runCommand({
            args: ['-q', '90', '-o', outputPath, ...inputPaths],
            cmd: 'heif-enc',
        });
        if (encode.exitCode !== 0) {
            throw new MacOSDynamicWallpaperEncodingError(
                `HEIC encoding failed: ${await commandError(encode)}`,
            );
        }

        const info = await sandbox.runCommand({
            args: [outputPath],
            cmd: 'heif-info',
        });
        const infoOutput = await info.stdout();
        const imageCount = infoOutput.match(/^image: /gm)?.length ?? 0;
        if (info.exitCode !== 0 || imageCount !== 4) {
            throw new MacOSDynamicWallpaperEncodingError(
                'HEIC validation did not find all four wallpaper frames.',
            );
        }

        const output = await sandbox.readFileToBuffer({ path: outputPath });
        if (!output || !hasMacOSDynamicWallpaperMetadata(output)) {
            throw new MacOSDynamicWallpaperEncodingError(
                'HEIC validation did not find the macOS schedule metadata.',
            );
        }
        return output;
    } finally {
        await sandbox.stop().catch((error: unknown) => {
            console.warn('Unable to stop macOS wallpaper sandbox', { error });
        });
    }
}
