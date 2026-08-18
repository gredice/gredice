import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Metadata } from 'next';
import {
    changelogArchiveMetadata,
    changelogArchiveSeo,
    newsArchiveMetadata,
    newsArchiveSeo,
} from './newsArchiveMetadata.ts';

type ExpectedArchiveMetadata = {
    canonicalUrl: string;
    description: string;
    documentTitle: string;
    imageAlt: string;
    imageUrl: string;
    title: string;
};

function assertArchiveMetadata(
    metadata: Metadata,
    expected: ExpectedArchiveMetadata,
) {
    assert.deepEqual(metadata.title, {
        absolute: expected.documentTitle,
    });
    assert.deepEqual(metadata.alternates, {
        canonical: expected.canonicalUrl,
    });
    assert.deepEqual(metadata.openGraph, {
        title: expected.title,
        description: expected.description,
        images: [
            {
                alt: expected.imageAlt,
                height: 630,
                type: 'image/png',
                url: expected.imageUrl,
                width: 1200,
            },
        ],
        locale: 'hr_HR',
        siteName: 'Gredice',
        type: 'website',
        url: expected.canonicalUrl,
    });
    assert.deepEqual(metadata.twitter, {
        card: 'summary_large_image',
        title: expected.title,
        description: expected.description,
        images: [
            {
                alt: expected.imageAlt,
                url: expected.imageUrl,
            },
        ],
    });
}

describe('news archive metadata', () => {
    it('publishes a complete combined archive social preview contract', () => {
        assertArchiveMetadata(newsArchiveMetadata, newsArchiveSeo);
    });

    it('publishes a complete changelog archive social preview contract', () => {
        assertArchiveMetadata(changelogArchiveMetadata, changelogArchiveSeo);
    });

    it('keeps the two archive previews distinct', () => {
        assert.notEqual(
            newsArchiveSeo.canonicalUrl,
            changelogArchiveSeo.canonicalUrl,
        );
        assert.notEqual(newsArchiveSeo.title, changelogArchiveSeo.title);
        assert.notEqual(newsArchiveSeo.imageUrl, changelogArchiveSeo.imageUrl);
    });
});
