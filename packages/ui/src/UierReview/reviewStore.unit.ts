import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewSessionKey } from './reviewState';
import {
    endUierReviewSession,
    prepareReview,
    reviewSnapshot,
    toggleReview,
} from './reviewStore';

function browserFixture(
    href = 'https://www.gredice.com/plants',
    scriptLoaded = false,
) {
    const values = new Map<string, string>();
    const navigations: string[] = [];
    const url = new URL(href);
    const browser = {
        location: {
            href,
            search: url.search,
            assign: (target: string) => navigations.push(target),
        },
        sessionStorage: {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
            removeItem: (key: string) => values.delete(key),
        },
        get parent() {
            return browser;
        },
    };
    const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const originalDocument = Object.getOwnPropertyDescriptor(
        globalThis,
        'document',
    );
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: browser,
    });
    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: {
            getElementById: (id: string) =>
                scriptLoaded && id === 'gredice-uier-review' ? {} : null,
        },
    });
    return {
        browser,
        values,
        navigations,
        restore() {
            if (original) Object.defineProperty(globalThis, 'window', original);
            else Reflect.deleteProperty(globalThis, 'window');
            if (originalDocument)
                Object.defineProperty(globalThis, 'document', originalDocument);
            else Reflect.deleteProperty(globalThis, 'document');
        },
    };
}

test('fresh visitors do not prepare a vendor session', () => {
    const fixture = browserFixture();
    try {
        assert.equal(prepareReview('www', 'web_project'), false);
        assert.equal(reviewSnapshot(), 'disabled');
        assert.deepEqual([...fixture.values], []);
    } finally {
        fixture.restore();
    }
});

test('WWW opt-in never enables News on the same origin', () => {
    const fixture = browserFixture('https://www.gredice.com/?review=true');
    try {
        assert.equal(prepareReview('www', 'web_project'), true);
        assert.equal(fixture.values.get(reviewSessionKey('www')), '1');
        fixture.browser.location.search = '';
        assert.equal(prepareReview('news', 'news_project'), false);
        fixture.browser.location.search = '?review=true';
        assert.equal(prepareReview('news', 'news_project'), true);
        assert.equal(
            fixture.values.get('uier:review'),
            JSON.stringify({ projectCode: 'news_project' }),
        );
    } finally {
        fixture.restore();
    }
});

test('vendor exit survives navigation and explicit re-enable clears it', () => {
    const fixture = browserFixture('https://www.gredice.com/?review=true');
    try {
        prepareReview('www', 'web_project');
        fixture.values.set('uier:review-exited', '1');
        fixture.browser.location.search = '';
        assert.equal(prepareReview('www', 'web_project'), false);
        fixture.browser.location.search = '?review=true';
        assert.equal(prepareReview('www', 'web_project'), true);
        assert.equal(fixture.values.has('uier:review-exited'), false);
    } finally {
        fixture.restore();
    }
});

test('disabling reloads the current route and persists the app opt-out', () => {
    const fixture = browserFixture(
        'https://www.gredice.com/plants?q=tomato&review=true#care',
    );
    try {
        prepareReview('www', 'web_project');
        toggleReview(false);
        assert.equal(fixture.values.get(reviewSessionKey('www')), '0');
        assert.equal(fixture.values.has('uier:review'), false);
        assert.deepEqual(fixture.navigations, [
            'https://www.gredice.com/plants?q=tomato&review=false#care',
        ]);
    } finally {
        fixture.restore();
    }
});

test('logout ends the saved review and replaces a document with the vendor loaded', () => {
    const fixture = browserFixture(
        'https://farma.gredice.com/settings?review=true&uier-token=secret#feedback',
        true,
    );
    try {
        prepareReview('farm', 'farm_project');
        assert.equal(endUierReviewSession('farm'), true);
        assert.equal(fixture.values.get(reviewSessionKey('farm')), '0');
        assert.equal(fixture.values.has('uier:review'), false);
        assert.equal(fixture.values.has('gredice:uier:owner'), false);
        assert.equal(reviewSnapshot(), 'disabled');
        assert.deepEqual(fixture.navigations, [
            'https://farma.gredice.com/settings?review=false#feedback',
        ]);
    } finally {
        fixture.restore();
    }
});

test('ordinary logout keeps the existing app refresh without document navigation', () => {
    const fixture = browserFixture('https://dostava.gredice.com/');
    try {
        prepareReview('delivery', 'delivery_project');
        assert.equal(endUierReviewSession('delivery'), false);
        assert.equal(fixture.values.get(reviewSessionKey('delivery')), '0');
        assert.deepEqual(fixture.navigations, []);
    } finally {
        fixture.restore();
    }
});

test('admin logout clears feedback while preserving its own landing-page navigation', () => {
    const fixture = browserFixture(
        'https://app.gredice.com/admin/logout?review=true',
        true,
    );
    try {
        prepareReview('app', 'admin_project');
        assert.equal(endUierReviewSession('app', { navigate: false }), true);
        assert.equal(fixture.values.get(reviewSessionKey('app')), '0');
        assert.equal(fixture.values.has('uier:review'), false);
        assert.equal(reviewSnapshot(), 'disabled');
        assert.deepEqual(fixture.navigations, []);
    } finally {
        fixture.restore();
    }
});
