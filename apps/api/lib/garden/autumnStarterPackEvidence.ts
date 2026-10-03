import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { autumnArrangements } from '@gredice/js/autumnArrangements';
import {
    autumnStarterPackRecipes,
    reviewedAutumnStarterPackEvidenceSchema,
} from './autumnStarterPackPreparation';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const sha256 = (data: Uint8Array) =>
    createHash('sha256').update(data).digest('hex');

/** Compare current bytes to reviewed offline evidence. No Git history or network required. */
export async function loadReviewedAutumnStarterPackEvidence(
    readBytes: (path: string) => Promise<Uint8Array> = (path) =>
        readFile(resolve(repositoryRoot, path)),
) {
    const manifest = JSON.parse(
        await readFile(
            new URL(
                './autumnStarterPackEvidence.reviewed.json',
                import.meta.url,
            ),
            'utf8',
        ),
    );
    const evidence = reviewedAutumnStarterPackEvidenceSchema.parse(manifest);
    for (const recipe of autumnStarterPackRecipes) {
        const arrangement = autumnArrangements.find(
            (item) => item.id === recipe.arrangementId,
        );
        const proof = evidence[recipe.arrangementId];
        if (
            !arrangement ||
            !proof ||
            proof.previewSha256 !== recipe.previewSha256
        )
            throw new Error(
                `Missing reviewed evidence: ${recipe.arrangementId}`,
            );
        const capture = await readBytes(
            `docs/autumn-arrangements-2026/${recipe.arrangementId}.json`,
        );
        if (sha256(capture) !== proof.captureSha256)
            throw new Error(
                `Committed reviewed capture record changed: ${recipe.arrangementId}`,
            );
        if (
            proof.recapture &&
            !isDeepStrictEqual(
                JSON.parse(new TextDecoder().decode(capture)).source,
                proof.recapture.source,
            )
        )
            throw new Error(
                `Reviewed recapture source differs: ${recipe.arrangementId}`,
            );
        const preview = await readBytes(
            `apps/garden/public${arrangement.preview}`,
        );
        if (sha256(preview) !== proof.previewSha256)
            throw new Error(
                `Reviewed preview changed: ${recipe.arrangementId}`,
            );
        for (const file of proof.files) {
            const bytes = await readBytes(file.path);
            if (sha256(bytes) !== file.sha256)
                throw new Error(
                    `Model/runtime input differs from reviewed capture: ${file.path}`,
                );
        }
    }
    return evidence;
}
