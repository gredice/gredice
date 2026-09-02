import type {
    WallpaperBranding,
    WallpaperPhase,
    WallpaperSizeKey,
    WallpaperTemplate,
} from './wallpaperComposer';

const encryptionVersion = 1;
const encryptionIvBytes = 12;

function base64Url(bytes: Uint8Array) {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary)
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '');
}

export async function createMacOSDynamicWallpaperEncryption() {
    const rawKey = crypto.getRandomValues(new Uint8Array(32));
    return {
        encodedKey: base64Url(rawKey),
        key: await crypto.subtle.importKey(
            'raw',
            rawKey,
            { name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt'],
        ),
    };
}

export async function encryptMacOSDynamicWallpaperBlob({
    blob,
    key,
    pathname,
}: {
    blob: Blob;
    key: CryptoKey;
    pathname: string;
}) {
    const iv = crypto.getRandomValues(new Uint8Array(encryptionIvBytes));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            {
                additionalData: new TextEncoder().encode(pathname),
                iv,
                name: 'AES-GCM',
            },
            key,
            await blob.arrayBuffer(),
        ),
    );
    const encrypted = new Uint8Array(
        1 + encryptionIvBytes + ciphertext.byteLength,
    );
    encrypted[0] = encryptionVersion;
    encrypted.set(iv, 1);
    encrypted.set(ciphertext, 1 + encryptionIvBytes);
    return new Blob([encrypted], { type: 'application/octet-stream' });
}

export async function decryptMacOSDynamicWallpaperBlob({
    blob,
    contentType,
    key,
    pathname,
}: {
    blob: Blob;
    contentType: string;
    key: CryptoKey;
    pathname: string;
}) {
    const encrypted = new Uint8Array(await blob.arrayBuffer());
    if (
        encrypted.byteLength <= 1 + encryptionIvBytes + 16 ||
        encrypted[0] !== encryptionVersion
    ) {
        throw new Error('Preuzeta HEIC pozadina nije valjana.');
    }
    const decrypted = await crypto.subtle.decrypt(
        {
            additionalData: new TextEncoder().encode(pathname),
            iv: encrypted.slice(1, 1 + encryptionIvBytes),
            name: 'AES-GCM',
        },
        key,
        encrypted.slice(1 + encryptionIvBytes),
    );
    return new Blob([decrypted], { type: contentType });
}

export function macOSDynamicWallpaperInputPath({
    conversionId,
    gardenId,
    phase,
}: {
    conversionId: string;
    gardenId: number;
    phase: WallpaperPhase;
}) {
    return `wallpapers/macos-dynamic/input/${gardenId.toString()}/${conversionId}/${phase}.bin`;
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
        'mac-dinamicka.heic',
    ].join('-');
}
