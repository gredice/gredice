import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicBreadcrumbStructuredData } from './breadcrumbStructuredData.ts';
import {
    serializeValidStructuredData,
    validateSerializedStructuredData,
    validateStructuredData,
} from './structuredDataValidation.ts';

test('accepts Products qualified by an Offer, Review, or AggregateRating', () => {
    const qualifiers = [
        {
            offers: {
                '@type': 'Offer',
                price: '2.99',
                priceCurrency: 'EUR',
            },
        },
        {
            review: {
                '@type': 'Review',
                reviewRating: {
                    '@type': 'Rating',
                    ratingValue: 5,
                },
                author: {
                    '@type': 'Person',
                    name: 'Gredice korisnik',
                },
            },
        },
        {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: 4.8,
                reviewCount: 12,
            },
        },
    ];

    for (const qualifier of qualifiers) {
        assert.deepEqual(
            validateStructuredData({
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: 'Rajčica',
                ...qualifier,
            }),
            [],
        );
    }
});

test('finds invalid Products recursively in graphs and lists', () => {
    const issues = validateStructuredData({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'ItemList',
                itemListElement: [
                    {
                        '@type': 'ListItem',
                        position: 1,
                        item: {
                            '@type': 'Product',
                            name: 'Sjeme bez ponude',
                        },
                    },
                ],
            },
            {
                '@type': 'Product',
                name: 'Sorta s ponudom',
                offers: {
                    '@type': 'Offer',
                    price: 2.99,
                    priceCurrency: 'EUR',
                },
                isVariantOf: {
                    '@type': 'Product',
                    name: 'Biljka bez ponude',
                },
            },
        ],
    });

    assert.equal(issues.length, 2);
    assert.ok(
        issues.every((issue) =>
            issue.message.includes('offers, review, or aggregateRating'),
        ),
    );
});

test('rejects malformed non-empty Product qualifiers', () => {
    const malformedQualifiers = [
        { offers: {} },
        { offers: 'not-an-offer' },
        {
            offers: {
                '@type': 'Offer',
                priceCurrency: 'EUR',
            },
        },
        {
            review: {
                '@type': 'Review',
                reviewRating: {},
                author: {
                    '@type': 'Person',
                    name: 'Gredice korisnik',
                },
            },
        },
        {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: 4.8,
                reviewCount: 0,
            },
        },
    ];

    for (const qualifier of malformedQualifiers) {
        const issues = validateStructuredData({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: 'Rajčica',
            ...qualifier,
        });

        assert.ok(
            issues.some((issue) =>
                issue.message.includes('offers, review, or aggregateRating'),
            ),
        );
    }
});

test('rejects incomplete Offers and AggregateOffers', () => {
    const issues = validateStructuredData({
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Product',
                name: 'Biljka',
                offers: {
                    '@type': 'Offer',
                    priceCurrency: 'eur',
                },
            },
            {
                '@type': 'Product',
                name: 'Sjeme',
                offers: {
                    '@type': 'AggregateOffer',
                    priceCurrency: 'EUR',
                },
            },
        ],
    });

    assert.deepEqual(
        issues.map((issue) => issue.message),
        [
            'Product must specify offers, review, or aggregateRating for Google Product snippets.',
            'Offer must have a non-negative numeric price.',
            'Offer must have a three-letter uppercase ISO priceCurrency.',
            'Product must specify offers, review, or aggregateRating for Google Product snippets.',
            'AggregateOffer must have a non-negative lowPrice.',
        ],
    );
});

test('rejects invalid JSON and non-schema.org roots', () => {
    assert.deepEqual(validateSerializedStructuredData('{invalid'), [
        {
            path: '$',
            message: 'Structured data script must contain valid JSON.',
        },
    ]);

    assert.deepEqual(validateStructuredData({ '@type': 'Thing' }), [
        {
            path: '$',
            message:
                'Structured data root must use the https://schema.org context.',
        },
    ]);
});

test('builds valid BreadcrumbList data from the visible breadcrumb items', () => {
    const structuredData = createPublicBreadcrumbStructuredData([
        { label: 'Sjeme', href: '/sjeme' },
        { label: 'Brendovi sjemena', href: '/sjeme/brendovi' },
        { label: 'Royal Seeds' },
    ]);

    assert.deepEqual(structuredData.itemListElement, [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Sjeme',
            item: 'https://www.gredice.com/sjeme',
        },
        {
            '@type': 'ListItem',
            position: 2,
            name: 'Brendovi sjemena',
            item: 'https://www.gredice.com/sjeme/brendovi',
        },
        {
            '@type': 'ListItem',
            position: 3,
            name: 'Royal Seeds',
        },
    ]);
    assert.deepEqual(validateStructuredData(structuredData), []);
});

test('rejects BreadcrumbLists that do not meet Google requirements', () => {
    const issues = validateStructuredData({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'Thing',
                position: 2.5,
                name: '',
                item: '/sjeme',
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: 'Detalj',
                item: '/sjeme/detalj',
            },
        ],
    });

    assert.deepEqual(
        issues.map((issue) => issue.message),
        [
            'BreadcrumbList entries must use @type ListItem.',
            'Breadcrumb ListItem positions must be sequential positive integers.',
            'Breadcrumb ListItem must have a non-empty name.',
            'Breadcrumb ListItem must have an absolute HTTP(S) item URL unless it is last.',
            'Breadcrumb ListItem positions must be sequential positive integers.',
            'Breadcrumb ListItem must have an absolute HTTP(S) item URL unless it is last.',
        ],
    );

    assert.deepEqual(
        validateStructuredData({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Sjeme',
                    item: 'https://www.gredice.com/sjeme',
                },
            ],
        }),
        [
            {
                path: '$',
                message: 'BreadcrumbList must contain at least two ListItems.',
            },
        ],
    );
});

test('serializes only valid structured data and escapes HTML delimiters', () => {
    const validResult = serializeValidStructuredData({
        '@context': 'https://schema.org',
        '@type': 'Thing',
        name: '<Rajčica>',
    });

    assert.deepEqual(validResult.issues, []);
    assert.equal(
        validResult.serializedData,
        '{"@context":"https://schema.org","@type":"Thing","name":"\\u003cRajčica>"}',
    );

    const invalidResult = serializeValidStructuredData({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Sjeme bez ponude',
    });

    assert.equal(invalidResult.serializedData, null);
    assert.deepEqual(invalidResult.issues, [
        {
            path: '$',
            message:
                'Product must specify offers, review, or aggregateRating for Google Product snippets.',
        },
    ]);
});
