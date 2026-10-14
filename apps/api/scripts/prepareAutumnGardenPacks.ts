import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadReviewedAutumnStarterPackEvidence } from '../lib/garden/autumnStarterPackEvidence';
import { prepareAutumnStarterPacks } from '../lib/garden/autumnStarterPackPreparation';

const [inputPath, outputDirectory, ...extra] = process.argv.slice(2);
if (!inputPath || !outputDirectory || extra.length) {
    throw new Error(
        'Usage: pnpm --filter api prepare:autumn-packs <published-block-export.json> <new-output-directory>',
    );
}
const maximumBytes = 10_000_000;
const input = resolve(inputPath);
const metadata = await stat(input);
if (!metadata.isFile() || metadata.size > maximumBytes)
    throw new Error(
        'Published directory export must be a regular file up to 10 MB',
    );
const source = await readFile(input);
if (source.byteLength > maximumBytes)
    throw new Error('Published directory export exceeds 10 MB');
const reviewedEvidence = await loadReviewedAutumnStarterPackEvidence();
const result = prepareAutumnStarterPacks(
    JSON.parse(source.toString('utf8')),
    reviewedEvidence,
);
// Refuse existing output folders; never overwrite a prior reviewer artifact/config.
const destination = resolve(outputDirectory);
await mkdir(destination);
await writeFile(
    resolve(destination, 'report.json'),
    `${JSON.stringify({ ...result, generatedAt: new Date().toISOString(), inputSha256: createHash('sha256').update(source).digest('hex'), note: 'Offline preparation only; drafts and sales disabled. Missing published models block all output. No asset deployment verification, publication or environment update performed.' }, null, 2)}\n`,
    { flag: 'wx' },
);
if (result.ready)
    await writeFile(
        resolve(destination, 'draft-catalogue.json'),
        `${JSON.stringify(result.offers, null, 2)}\n`,
        { flag: 'wx' },
    );
console.log(
    `${result.ready ? 'Prepared three disabled drafts' : 'BLOCKED: no draft catalogue emitted'}. Review ${destination}/report.json`,
);
if (!result.ready) process.exitCode = 1;
