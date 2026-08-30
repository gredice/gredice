import assert from 'node:assert/strict';
import test from 'node:test';
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
