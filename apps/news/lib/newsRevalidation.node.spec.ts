import assert from 'node:assert/strict';
import test from 'node:test';
import {
    newsArticleHash,
    newsRevalidationTargets,
} from '@gredice/storage/cmsNewsRevalidation';

test('retry slugs are bounded and cannot target unrelated routes', () => {
    assert.deepEqual(
        newsRevalidationTargets([
            'novosti/article',
            'novosti/article',
            'novosti/sto-je-novo/release',
            '../admin',
            'novosti/../admin',
            'novosti/a?tag=x',
            'novosti/sto-je-novo',
            `novosti/${'a'.repeat(201)}`,
            null,
        ]),
        [
            'novosti/article',
            'novosti/sto-je-novo/release',
            `tag:${newsArticleHash(`novosti/${'a'.repeat(201)}`)}`,
        ],
    );
});
