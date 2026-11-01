import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertSafeGameProfileOutputDirectory } from './game-profile-output.mjs';

/** Raw checkpoints are not an acceptance report; only a finished matrix is one. */
export async function createGameProfileCheckpoint(outDir, metadata) {
    const directory = assertSafeGameProfileOutputDirectory(outDir);
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, `${randomUUID()}.runs.jsonl`);
    await writeFile(
        path,
        `${JSON.stringify({ type: 'header', version: 1, metadata })}\n`,
        { flag: 'wx' },
    );
    return {
        path,
        async record(record) {
            await appendFile(path, `${JSON.stringify(record)}\n`);
        },
    };
}
