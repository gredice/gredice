#!/usr/bin/env node

import { createRequire } from 'node:module';
import {
    encryptColumnValue,
    isColumnEncryptionConfigured,
    isEncryptedColumnValue,
} from '../packages/storage/src/security/columnEncryption.ts';

const storageRequire = createRequire(
    new URL('../packages/storage/package.json', import.meta.url),
);
const { Pool } = storageRequire('pg');
const args = new Set(process.argv.slice(2));
const isDryRun = args.has('--dry-run');
const batchSize = 100;

function printUsage() {
    console.log(`Usage: node scripts/encrypt-fiscalization-settings.mjs [--dry-run]

Encrypt plaintext fiscalization certificate columns in fiscalization_user_settings.

Required environment variables:
  POSTGRES_URL                         PostgreSQL connection string
  GREDICE_COLUMN_ENCRYPTION_KEY        Base64-encoded 32-byte AES key

Options:
  --dry-run                            Print row IDs that would be updated without writing
  --help                               Show this help message`);
}

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        console.error(`${name} environment variable is required.`);
        process.exit(1);
    }

    return value;
}

if (args.has('--help')) {
    printUsage();
    process.exit(0);
}

for (const arg of args) {
    if (arg !== '--dry-run') {
        console.error(`Unknown option: ${arg}`);
        printUsage();
        process.exit(1);
    }
}

function hasPlaintextCredentials(row) {
    if (
        typeof row.cert_base64 !== 'string' ||
        typeof row.cert_password !== 'string'
    ) {
        return false;
    }

    return (
        !isEncryptedColumnValue(row.cert_base64) ||
        !isEncryptedColumnValue(row.cert_password)
    );
}

function encryptIfNeeded(value) {
    return isEncryptedColumnValue(value) ? value : encryptColumnValue(value);
}

const connectionString = requireEnv('POSTGRES_URL');
requireEnv('GREDICE_COLUMN_ENCRYPTION_KEY');

if (!isColumnEncryptionConfigured()) {
    console.error(
        'GREDICE_COLUMN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
    );
    process.exit(1);
}

const pool = new Pool({ connectionString });

let lastSeenId = 0;
let changedCount = 0;

try {
    while (true) {
        const result = await pool.query(
            'SELECT id, cert_base64, cert_password FROM fiscalization_user_settings WHERE id > $1 ORDER BY id LIMIT $2',
            [lastSeenId, batchSize],
        );
        if (result.rows.length === 0) {
            break;
        }

        lastSeenId = result.rows[result.rows.length - 1].id;
        const rowsToMigrate = result.rows.filter(hasPlaintextCredentials);

        if (rowsToMigrate.length === 0) {
            continue;
        }

        changedCount += rowsToMigrate.length;

        if (isDryRun) {
            console.log(
                `Would encrypt fiscalization_user_settings row(s): ${rowsToMigrate.map((row) => row.id).join(', ')}`,
            );
            continue;
        }

        const client = await pool.connect();
        try {
            await client.query('START TRANSACTION');
            for (const row of rowsToMigrate) {
                await client.query(
                    'UPDATE fiscalization_user_settings SET cert_base64 = $1, cert_password = $2 WHERE id = $3',
                    [
                        encryptIfNeeded(row.cert_base64),
                        encryptIfNeeded(row.cert_password),
                        row.id,
                    ],
                );
                console.log(
                    `Encrypted fiscalization_user_settings row ${row.id}.`,
                );
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    if (changedCount === 0) {
        console.log('No fiscalization_user_settings rows require encryption.');
    } else if (isDryRun) {
        console.log(
            `Would encrypt ${changedCount} fiscalization_user_settings row(s).`,
        );
    } else {
        console.log(
            `Encrypted ${changedCount} fiscalization_user_settings row(s).`,
        );
    }
} finally {
    await pool.end();
}
