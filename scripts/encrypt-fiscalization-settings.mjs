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

const connectionString = requireEnv('POSTGRES_URL');
requireEnv('GREDICE_COLUMN_ENCRYPTION_KEY');

if (!isColumnEncryptionConfigured()) {
    console.error(
        'GREDICE_COLUMN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
    );
    process.exit(1);
}

const pool = new Pool({ connectionString });

try {
    const result = await pool.query(
        'select id, cert_base64, cert_password from fiscalization_user_settings order by id',
    );
    const rowsToMigrate = result.rows.filter(
        (row) =>
            !isEncryptedColumnValue(row.cert_base64) ||
            !isEncryptedColumnValue(row.cert_password),
    );

    if (rowsToMigrate.length === 0) {
        console.log('No fiscalization_user_settings rows require encryption.');
    } else if (isDryRun) {
        console.log(
            `Would encrypt ${rowsToMigrate.length} fiscalization_user_settings row(s): ${rowsToMigrate.map((row) => row.id).join(', ')}`,
        );
    } else {
        for (const row of rowsToMigrate) {
            const certBase64 = isEncryptedColumnValue(row.cert_base64)
                ? row.cert_base64
                : encryptColumnValue(row.cert_base64);
            const certPassword = isEncryptedColumnValue(row.cert_password)
                ? row.cert_password
                : encryptColumnValue(row.cert_password);

            await pool.query(
                'update fiscalization_user_settings set cert_base64 = $1, cert_password = $2 where id = $3',
                [certBase64, certPassword, row.id],
            );
            console.log(`Encrypted fiscalization_user_settings row ${row.id}.`);
        }

        console.log(
            `Encrypted ${rowsToMigrate.length} fiscalization_user_settings row(s).`,
        );
    }
} finally {
    await pool.end();
}
