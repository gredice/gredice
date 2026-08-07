import { strToU8, zipSync } from 'fflate';
import type {
    WallpaperBranding,
    WallpaperPhase,
    WallpaperSizeKey,
    WallpaperTemplate,
} from './wallpaperComposer';

type MacOSDynamicWallpaperFrame = {
    blob: Blob;
    phase: WallpaperPhase;
};

const frameConfiguration = [
    {
        fileName: '01-gredice-jutro.png',
        phase: 'morning',
        time: '2026-06-21T06:00:00',
    },
    {
        fileName: '02-gredice-dan.png',
        isForLight: true,
        isPrimary: true,
        phase: 'day',
        time: '2026-06-21T10:00:00',
    },
    {
        fileName: '03-gredice-vecer.png',
        phase: 'evening',
        time: '2026-06-21T18:00:00',
    },
    {
        fileName: '04-gredice-noc.png',
        isForDark: true,
        phase: 'night',
        time: '2026-06-21T21:00:00',
    },
] satisfies ReadonlyArray<{
    fileName: string;
    isForDark?: boolean;
    isForLight?: boolean;
    isPrimary?: boolean;
    phase: WallpaperPhase;
    time: string;
}>;

export function getMacOSDynamicWallpaperManifest() {
    return frameConfiguration.map(
        ({ fileName, isForDark, isForLight, isPrimary, time }) => ({
            fileName,
            ...(isPrimary ? { isPrimary: true } : {}),
            ...(isForLight ? { isForLight: true } : {}),
            ...(isForDark ? { isForDark: true } : {}),
            time,
        }),
    );
}

export function macOSDynamicWallpaperFileName({
    branding,
    size,
    template,
}: {
    branding: WallpaperBranding;
    size: WallpaperSizeKey;
    template: WallpaperTemplate;
}) {
    return [
        'gredice-vrt',
        template,
        size,
        branding === 'gredice' ? 'potpis' : 'cista',
        'mac-dinamicka.zip',
    ].join('-');
}

function macOSInstructions() {
    return [
        'GREDICE DINAMIČKA POZADINA ZA MAC',
        '',
        'Paket sadrži četiri PNG pozadine i vremenski raspored za jutro, dan, večer i noć.',
        'Sve slike izrađene su lokalno u tvom pregledniku.',
        '',
        'IZRADA NATIVNE HEIC POZADINE',
        '',
        '1. Raspakiraj ovaj ZIP na Macu.',
        '2. Ako nemaš alat wallpapper, u Terminalu pokreni:',
        '   brew tap mczachurski/wallpapper',
        '   brew install wallpapper',
        '3. U Terminalu otvori raspakiranu mapu i pokreni:',
        '   zsh izradi-heic.command',
        '4. U System Settings > Wallpaper dodaj datoteku gredice-dinamicka.heic.',
        '5. Ako se prikaže izbor načina, odaberi Dynamic ili Automatic.',
        '',
        'Datoteka wallpapper.json sadrži raspored promjena prema lokalnom vremenu Maca.',
    ].join('\n');
}

function macOSBuildScript() {
    return [
        '#!/bin/zsh',
        'set -euo pipefail',
        'cd -- "$(dirname -- "$0")"',
        '',
        'if ! command -v wallpapper >/dev/null 2>&1; then',
        '    print "Nedostaje alat wallpapper."',
        '    print "Instaliraj ga naredbama iz datoteke UPUTE.txt."',
        '    exit 1',
        'fi',
        '',
        'wallpapper -i wallpapper.json -o gredice-dinamicka.heic',
        'print "Izrađena je datoteka gredice-dinamicka.heic"',
    ].join('\n');
}

export async function createMacOSDynamicWallpaperBundle({
    frames,
}: {
    frames: ReadonlyArray<MacOSDynamicWallpaperFrame>;
}) {
    const framesByPhase = new Map<WallpaperPhase, Blob>();
    for (const frame of frames) {
        if (framesByPhase.has(frame.phase)) {
            throw new Error(
                `Pozadina za doba dana ${frame.phase} je duplicirana.`,
            );
        }
        framesByPhase.set(frame.phase, frame.blob);
    }

    const files: Record<string, Uint8Array> = {
        'UPUTE.txt': strToU8(macOSInstructions()),
        'izradi-heic.command': strToU8(macOSBuildScript()),
        'wallpapper.json': strToU8(
            JSON.stringify(getMacOSDynamicWallpaperManifest(), null, 2),
        ),
    };

    for (const configuration of frameConfiguration) {
        const frame = framesByPhase.get(configuration.phase);
        if (!frame) {
            throw new Error(
                `Nedostaje pozadina za doba dana ${configuration.phase}.`,
            );
        }
        files[configuration.fileName] = new Uint8Array(
            await frame.arrayBuffer(),
        );
    }

    const archive = zipSync(files, { level: 0 });
    const stableArchive = new Uint8Array(archive.byteLength);
    stableArchive.set(archive);
    return new Blob([stableArchive], { type: 'application/zip' });
}
