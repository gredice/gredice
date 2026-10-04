import assert from 'node:assert/strict';
import type { ReactElement } from 'react';
import { render } from 'react-email';

export async function renderNonEmpty(element: ReactElement) {
    const html = await render(element);

    assert.ok(html.trim().length > 0);

    return html;
}

export function assertHtmlIncludes(html: string, expected: string) {
    assert.ok(
        html.includes(expected),
        `Expected rendered HTML to include "${expected}".`,
    );
}
