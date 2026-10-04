import assert from 'node:assert/strict';
import test from 'node:test';
import { getAiAnalysisErrorMessage } from './aiAnalysisError';

test('getAiAnalysisErrorMessage reads API error JSON bodies', async () => {
    const message = await getAiAnalysisErrorMessage(
        new Response(
            JSON.stringify({
                error: 'Iskoristili ste tjedni limit AI savjeta.',
            }),
            { status: 429 },
        ),
    );

    assert.strictEqual(message, 'Iskoristili ste tjedni limit AI savjeta.');
});

test('getAiAnalysisErrorMessage falls back for empty server errors', async () => {
    const message = await getAiAnalysisErrorMessage(
        new Response('', { status: 500 }),
    );

    assert.match(message, /Suncokret trenutno/);
});

test('getAiAnalysisErrorMessage does not show raw structured JSON', async () => {
    const message = await getAiAnalysisErrorMessage(
        new Response(JSON.stringify({ details: ['Invalid image URL'] }), {
            status: 400,
        }),
    );

    assert.strictEqual(
        message,
        'Analiza nije uspjela. Pokušaj ponovno kasnije.',
    );
});
