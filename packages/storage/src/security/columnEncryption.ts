import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const columnEncryptionKeyEnv = 'GREDICE_COLUMN_ENCRYPTION_KEY';
const encryptedValuePrefix = 'enc:v1:';
const ivLengthBytes = 12;
const authTagLengthBytes = 16;
const keyLengthBytes = 32;
const base64EncodedKeyPattern = /^[A-Za-z0-9+/]{43}=$/;

function readColumnEncryptionKey() {
    const encodedKey = process.env[columnEncryptionKeyEnv];
    if (!encodedKey) {
        throw new Error(
            `${columnEncryptionKeyEnv} must be set to a standard base64-encoded 32-byte key to encrypt or decrypt column values.`,
        );
    }

    if (!base64EncodedKeyPattern.test(encodedKey)) {
        throw new Error(
            `${columnEncryptionKeyEnv} must be a standard base64-encoded 32-byte key to encrypt or decrypt column values.`,
        );
    }

    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== keyLengthBytes) {
        throw new Error(
            `${columnEncryptionKeyEnv} must be a standard base64-encoded 32-byte key to encrypt or decrypt column values.`,
        );
    }

    return key;
}

export function isColumnEncryptionConfigured(): boolean {
    try {
        readColumnEncryptionKey();
        return true;
    } catch {
        return false;
    }
}

export function isEncryptedColumnValue(value: string): boolean {
    return value.startsWith(encryptedValuePrefix);
}

export function encryptColumnValue(plaintext: string): string {
    const key = readColumnEncryptionKey();
    const iv = randomBytes(ivLengthBytes);
    const cipher = createCipheriv('aes-256-gcm', key, iv, {
        authTagLength: authTagLengthBytes,
    });
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return `${encryptedValuePrefix}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptColumnValue(value: string): string {
    if (!isEncryptedColumnValue(value)) {
        return value;
    }

    const key = readColumnEncryptionKey();
    const parts = value.slice(encryptedValuePrefix.length).split(':');
    if (parts.length !== 3) {
        throw new Error(
            `Encrypted column value could not be decrypted. Verify ${columnEncryptionKeyEnv} is configured with the correct key.`,
        );
    }

    try {
        const [ivBase64, authTagBase64, ciphertextBase64] = parts;
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        const ciphertext = Buffer.from(ciphertextBase64, 'base64');
        const decipher = createDecipheriv('aes-256-gcm', key, iv, {
            authTagLength: authTagLengthBytes,
        });
        decipher.setAuthTag(authTag);

        return Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]).toString('utf8');
    } catch (error) {
        throw new Error(
            `Encrypted column value could not be decrypted. Verify ${columnEncryptionKeyEnv} is configured with the correct key.`,
            { cause: error },
        );
    }
}
