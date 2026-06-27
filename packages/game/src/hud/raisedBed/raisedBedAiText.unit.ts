import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeRaisedBedAiMarkdown } from '@gredice/js/ai';

function visibleMarkdownText(markdown: string) {
    return markdown.replace(/\]\([^)]*\)/g, '');
}

test('sanitizeRaisedBedAiMarkdown removes internal field names from visible recommendations', () => {
    const sanitized = sanitizeRaisedBedAiMarkdown(
        [
            '1. **Rukola coltivata — polje 10, positionIndex 9**',
            'Problem: spremna je za berbu.',
            'Idući korak: naručiti [Branje biljke](https://www.gredice.com/radnje/branje-biljke#raisedBedId=5&positionIndex=9).',
            '',
            "2. **Celer lisnati rebrasti d'elne — polje 4, positionIndex 3**",
            'Problem: označen je kao neizniknut/propao i `needsRemoval: true`; zauzima prostor bez koristi.',
        ].join('\n'),
    );
    const visibleText = visibleMarkdownText(sanitized);

    assert.match(sanitized, /positionIndex=9/);
    assert.match(visibleText, /Rukola coltivata — polje 10/);
    assert.match(visibleText, /označeno za uklanjanje/);
    assert.doesNotMatch(visibleText, /positionIndex/i);
    assert.doesNotMatch(visibleText, /needsRemoval/i);
});

test('sanitizeRaisedBedAiMarkdown rewrites bare operation URLs and field labels', () => {
    const sanitized = sanitizeRaisedBedAiMarkdown(
        'Naruči https://www.gredice.com/radnje/uklanjanje-biljke#raisedBedId=5&positionIndex=3 za positionLabel 4.',
    );

    assert.match(sanitized, /poveznica za radnju/);
    assert.match(sanitized, /polje 4/);
    assert.doesNotMatch(sanitized, /positionIndex/i);
    assert.doesNotMatch(sanitized, /positionLabel/i);
});
