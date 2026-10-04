import test from 'node:test';
import { createElement } from 'react';
import MarkdownEmailTemplate from '../emails/Newsletter/newsletter';
import { assertHtmlIncludes, renderNonEmpty } from './renderEmail';

test('newsletter renders with markdown content and links', async () => {
    const newsletterUrl = 'https://example.test/newsletter';
    const html = await renderNonEmpty(
        createElement(MarkdownEmailTemplate, {
            content: `Procitaj [testnu objavu](${newsletterUrl}) o sezoni.`,
            header: 'Testni newsletter',
            previewText: 'Testni pregled newslettera',
        }),
    );

    assertHtmlIncludes(html, 'Testni newsletter');
    assertHtmlIncludes(html, newsletterUrl);
});
