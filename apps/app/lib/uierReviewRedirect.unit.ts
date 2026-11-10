import assert from 'node:assert/strict';
import test from 'node:test';
import { adminReviewRedirectUrl } from './uierReviewRedirect';

test('root requests without review parameters keep the fixed admin destination', () => {
    assert.equal(adminReviewRedirectUrl({}), '/admin');
    assert.equal(
        adminReviewRedirectUrl({ redirect: 'https://external.invalid' }),
        '/admin',
    );
});

test('preserves each UIer launch parameter and ignores unrelated parameters', () => {
    const reviewParams = {
        review: 'true',
        'toolbar-code': 'project-code',
        'uier-token': 'reviewer-token',
        'uier-check': 'installation-check',
        'uier-comment': 'comment-id',
    };
    const destination = new URL(
        adminReviewRedirectUrl({
            ...reviewParams,
            token: 'unrelated-token',
            returnTo: '//external.invalid',
        }),
        'https://app.gredice.com',
    );

    assert.equal(destination.pathname, '/admin');
    assert.deepEqual(
        Object.fromEntries(destination.searchParams),
        reviewParams,
    );
});

test('ignores repeated parameter values and preserves an explicit review exit', () => {
    assert.equal(
        adminReviewRedirectUrl({
            review: 'false',
            'toolbar-code': ['first-code', 'second-code'],
            'uier-token': undefined,
        }),
        '/admin?review=false',
    );
});

test('encodes parameter values so they cannot alter the redirect destination', () => {
    const value = 'https://external.invalid/path?next=/other&review=false#hash';
    const destination = new URL(
        adminReviewRedirectUrl({ 'uier-comment': value }),
        'https://app.gredice.com',
    );

    assert.equal(destination.origin, 'https://app.gredice.com');
    assert.equal(destination.pathname, '/admin');
    assert.equal(destination.searchParams.get('uier-comment'), value);
    assert.equal(destination.searchParams.size, 1);
    assert.equal(destination.hash, '');
});
