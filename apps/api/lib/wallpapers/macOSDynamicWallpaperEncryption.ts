import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const version = 1;
const ivBytes = 12;
const authTagBytes = 16;

function encryptionKey(encodedKey: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(encodedKey)) {
        throw new Error('Invalid wallpaper encryption key');
    }
    const key = Buffer.from(encodedKey, 'base64url');
    if (key.byteLength !== 32) {
        throw new Error('Invalid wallpaper encryption key');
    }
    return key;
}

export function encryptMacOSDynamicWallpaperBytes({
    bytes,
    encodedKey,
    pathname,
}: {
    bytes: Uint8Array;
    encodedKey: string;
    pathname: string;
}) {
    const iv = randomBytes(ivBytes);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(encodedKey), iv);
    cipher.setAAD(Buffer.from(pathname));
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    return new Uint8Array(
        Buffer.concat([
            Buffer.from([version]),
            iv,
            ciphertext,
            cipher.getAuthTag(),
        ]),
    );
}

export function decryptMacOSDynamicWallpaperBytes({
    bytes,
    encodedKey,
    pathname,
}: {
    bytes: Uint8Array;
    encodedKey: string;
    pathname: string;
}) {
    if (
        bytes.byteLength <= 1 + ivBytes + authTagBytes ||
        bytes[0] !== version
    ) {
        throw new Error('Invalid encrypted wallpaper');
    }

    const iv = bytes.subarray(1, 1 + ivBytes);
    const authTag = bytes.subarray(bytes.byteLength - authTagBytes);
    const ciphertext = bytes.subarray(
        1 + ivBytes,
        bytes.byteLength - authTagBytes,
    );
    const decipher = createDecipheriv(
        'aes-256-gcm',
        encryptionKey(encodedKey),
        iv,
    );
    decipher.setAAD(Buffer.from(pathname));
    decipher.setAuthTag(authTag);
    return new Uint8Array(
        Buffer.concat([decipher.update(ciphertext), decipher.final()]),
    );
}
