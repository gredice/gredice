import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getReviewActivation,
    reviewSessionKey,
    reviewToggleUrl,
} from './reviewState';

test('normal visits never activate review, including malformed review parameters', () => {
    for (const query of [
        '',
        '?review=1',
        '?toolbar-code=%3Cscript%3E',
        '?uier-token=bad',
        '?uier-check=bad',
    ]) {
        assert.equal(getReviewActivation(query, null, false).enabled, false);
    }
});

test('explicit opt-in accepts UIer review and installation links', () => {
    for (const query of [
        '?review=true',
        '?toolbar-code=project_123',
        `?uier-token=${'a'.repeat(43)}`,
        '?uier-check=00000000-0000-0000-0000-000000000000',
    ]) {
        assert.deepEqual(getReviewActivation(query, null, true), {
            enabled: true,
            explicit: true,
        });
    }
});

test('exit and explicit opt-out override saved opt-in', () => {
    assert.equal(getReviewActivation('', '1', false).enabled, true);
    assert.equal(getReviewActivation('', '1', true).enabled, false);
    assert.equal(
        getReviewActivation('?review=false&toolbar-code=project', '1', false)
            .enabled,
        false,
    );
    assert.notEqual(reviewSessionKey('www'), reviewSessionKey('news'));
});

test('toggle navigation preserves page context but removes stale review credentials', () => {
    const result = new URL(
        reviewToggleUrl(
            'https://www.gredice.com/plants?q=rajcica&uier-token=secret&toolbar-code=project&uier-check=check&uier-comment=comment#care',
            false,
        ),
    );
    assert.equal(result.pathname, '/plants');
    assert.equal(result.hash, '#care');
    assert.equal(result.searchParams.get('q'), 'rajcica');
    assert.equal(result.searchParams.get('review'), 'false');
    for (const key of [
        'uier-token',
        'toolbar-code',
        'uier-check',
        'uier-comment',
    ])
        assert.equal(result.searchParams.has(key), false);
});
