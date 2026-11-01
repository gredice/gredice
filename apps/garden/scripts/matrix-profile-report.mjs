import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import {
    appendFile,
    link,
    mkdir,
    readFile,
    unlink,
    writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';

const hash = (value) => createHash('sha256').update(value).digest('hex');

/** Keep full evidence in the journal; stream the index and spill heavy windows. */
export async function writeMatrixProfileReport(
    journal,
    outDir,
    { expectedRows, preflight = false } = {},
) {
    const evidenceDirectory = `evidence-${randomUUID()}`;
    await mkdir(resolve(outDir, evidenceDirectory));
    const temporary = resolve(outDir, `.latest-${randomUUID()}.tmp`);
    const input = createReadStream(journal);
    const journalHash = createHash('sha256');
    input.on('data', (chunk) => journalHash.update(chunk));
    const lines = createInterface({ input, crlfDelay: Infinity });
    let header;
    let count = 0;
    try {
        for await (const line of lines) {
            const entry = JSON.parse(line);
            if (!header) {
                if (entry.type !== 'header')
                    throw new Error('Missing capture header');
                const { type: _type, ...metadata } = entry;
                header = metadata;
                await writeFile(
                    temporary,
                    `${JSON.stringify({ ...metadata, preflight, artifactSchemaVersion: 1 }).slice(0, -1)},"rows":[\n`,
                    { flag: 'wx' },
                );
                continue;
            }
            if (entry.type !== 'completed')
                throw new Error('Unexpected journal entry');
            const { allocation, trace, ...row } = entry.row;
            if (allocation || trace) {
                const evidence = JSON.stringify({ allocation, trace });
                row.allocationEvidenceFile = `${evidenceDirectory}/${String(count).padStart(4, '0')}.json`;
                row.allocationEvidenceSha256 = hash(evidence);
                await writeFile(
                    resolve(outDir, row.allocationEvidenceFile),
                    evidence,
                    { flag: 'wx' },
                );
            }
            await appendFile(
                temporary,
                `${count ? ',\n' : ''}${JSON.stringify(row)}`,
            );
            count++;
        }
        if (!header || count !== expectedRows)
            throw new Error(
                `Incomplete capture: expected ${expectedRows}, observed ${count}`,
            );
        const sourceJournalSha256 = journalHash.digest('hex');
        await appendFile(
            temporary,
            `\n],"completedRows":${count},"sourceJournalSha256":"${sourceJournalSha256}"}\n`,
        );
        // Publish only a complete index, without overwriting prior evidence.
        const output = resolve(outDir, 'latest.json');
        await link(temporary, output);
        return { output, completedRows: count, sourceJournalSha256 };
    } finally {
        lines.close();
        input.destroy();
        await unlink(temporary).catch((error) => {
            if (error.code !== 'ENOENT') throw error;
        });
    }
}

export async function loadMatrixProfileEvidence(input, row) {
    if (!row.allocationEvidenceFile) return row;
    const evidence = await readFile(
        resolve(dirname(input), row.allocationEvidenceFile),
        'utf8',
    );
    if (hash(evidence) !== row.allocationEvidenceSha256)
        throw new Error('Allocation evidence checksum mismatch');
    return JSON.parse(evidence);
}
