import { getOperationById } from '@gredice/storage';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import {
    generateOperationNoteSuggestion,
    loadOperationNoteContext,
    type NoteSuggestionOperation,
    operationNoteSuggestionInput,
    operationNoteSuggestionText,
} from '../../../lib/ai/operationNoteSuggestion';
import { authSecurity } from '../../../lib/docs/security';
import { authValidator } from '../../../lib/hono/authValidator';

const defaults = {
    authValidator,
    getOperation: (id: number): Promise<NoteSuggestionOperation> =>
        getOperationById(id),
    loadContext: loadOperationNoteContext,
    generate: generateOperationNoteSuggestion,
};

export function createAiOperationNotesRoutes(deps = defaults) {
    return new Hono().post(
        '/',
        describeRoute({
            description:
                'Suggest corrected Croatian completion notes for admin review. Does not save notes or perform operations. Automatic requests skip previously edited notes.',
            tags: ['Operation notes AI'],
            security: authSecurity,
            responses: {
                200: {
                    description:
                        'Suggested text, or skipped automatic suggestion.',
                },
                400: { description: 'Invalid note or operation version.' },
                401: { description: 'Admin authentication required.' },
                409: {
                    description:
                        'Operation changed or is no longer awaiting verification.',
                },
                503: { description: 'Suggestion temporarily unavailable.' },
            },
        }),
        deps.authValidator(['admin']),
        zValidator('json', operationNoteSuggestionInput),
        async (c) => {
            c.header('Cache-Control', 'no-store');
            const input = c.req.valid('json');
            try {
                const operation = await deps.getOperation(input.operationId);
                if (
                    operation.status !== 'pendingVerification' ||
                    operation.taskVersionEventId !==
                        input.expectedTaskVersionEventId
                ) {
                    return c.json(
                        {
                            error: 'Zapis se promijenio. Osvježite stranicu i pokušajte ponovno.',
                        },
                        409,
                    );
                }
                if (
                    input.mode === 'automatic' &&
                    (operation.completionNotesEdited ||
                        input.notes !== operation.completionNotes?.trim())
                ) {
                    return c.json({ suggestion: null, skipped: true }, 200);
                }
                const context = await deps.loadContext(operation);
                const suggestion = operationNoteSuggestionText.parse(
                    await deps.generate(input.notes, context, c.req.raw.signal),
                );
                const current = await deps.getOperation(input.operationId);
                if (
                    current.status !== 'pendingVerification' ||
                    current.taskVersionEventId !==
                        input.expectedTaskVersionEventId
                ) {
                    return c.json(
                        {
                            error: 'Zapis se promijenio. Osvježite stranicu i pokušajte ponovno.',
                        },
                        409,
                    );
                }
                return c.json({ suggestion, skipped: false }, 200);
            } catch {
                console.warn('operation.note.suggestion.failed', {
                    operationId: input.operationId,
                });
                return c.json(
                    {
                        error: 'Prijedlog trenutačno nije dostupan. Pokušajte ponovno.',
                    },
                    503,
                );
            }
        },
    );
}

export default createAiOperationNotesRoutes();
