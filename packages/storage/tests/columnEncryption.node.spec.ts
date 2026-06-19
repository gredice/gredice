import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import {
    decryptColumnValue,
    encryptColumnValue,
    isColumnEncryptionConfigured,
} from '../src/security/columnEncryption';

const keyEnv = 'GREDICE_COLUMN_ENCRYPTION_KEY';

function withColumnEncryptionKey<T>(
    key: string | undefined,
    callback: () => T,
): T {
    const originalKey = process.env[keyEnv];

    try {
        if (key === undefined) {
            delete process.env[keyEnv];
        } else {
            process.env[keyEnv] = key;
        }

        return callback();
    } finally {
        if (originalKey === undefined) {
            delete process.env[keyEnv];
        } else {
            process.env[keyEnv] = originalKey;
        }
    }
}

function syntheticKey() {
    return randomBytes(32).toString('base64');
}

test('encrypts and decrypts a column value', () => {
    withColumnEncryptionKey(syntheticKey(), () => {
        const plaintext = 'synthetic fiscalization credential';
        const encrypted = encryptColumnValue(plaintext);

        assert.match(encrypted, /^enc:v1:/);
        assert.equal(decryptColumnValue(encrypted), plaintext);
        assert.equal(isColumnEncryptionConfigured(), true);
    });
});

test('uses a fresh IV for each encryption', () => {
    withColumnEncryptionKey(syntheticKey(), () => {
        const plaintext = 'same synthetic value';

        assert.notEqual(
            encryptColumnValue(plaintext),
            encryptColumnValue(plaintext),
        );
    });
});

test('passes plaintext values through without a key', () => {
    withColumnEncryptionKey(undefined, () => {
        assert.equal(
            decryptColumnValue('not migrated yet'),
            'not migrated yet',
        );
        assert.equal(isColumnEncryptionConfigured(), false);
    });
});

test('throws when encrypted values are tampered with', () => {
    withColumnEncryptionKey(syntheticKey(), () => {
        const encrypted = encryptColumnValue('synthetic credential');
        const tampered = `${encrypted.slice(0, -1)}A`;

        assert.throws(
            () => decryptColumnValue(tampered),
            /GREDICE_COLUMN_ENCRYPTION_KEY/,
        );
    });
});

test('requires a key for encryption and encrypted-value decryption', () => {
    const encrypted = withColumnEncryptionKey(syntheticKey(), () =>
        encryptColumnValue('synthetic credential'),
    );

    withColumnEncryptionKey(undefined, () => {
        assert.throws(
            () => encryptColumnValue('synthetic credential'),
            /GREDICE_COLUMN_ENCRYPTION_KEY/,
        );
        assert.throws(
            () => decryptColumnValue(encrypted),
            /GREDICE_COLUMN_ENCRYPTION_KEY/,
        );
        assert.equal(
            decryptColumnValue('plaintext stays readable'),
            'plaintext stays readable',
        );
    });
});
