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
                        'Operation changed or no longer has editable completion notes.',
                },
                503: { description: 'Suggestion temporarily unavailable.' },
            },
        }),
        deps.authValidator(['admin']),
        zValidator('json', operationNoteSuggestionInput),
        async (c) => {
            c.header('Cache-Control', 'no-store');
            const input = c.req.valid('json');
            let stage = 'load_operation';
            try {
                const operation = await deps.getOperation(input.operationId);
                if (
                    (operation.status !== 'pendingVerification' &&
                        operation.status !== 'completed') ||
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
                stage = 'load_context';
                const context = await deps.loadContext(operation);
                stage = 'generate';
                const generated = await deps.generate(
                    input.notes,
                    context,
                    c.req.raw.signal,
                );
                stage = 'validate_output';
                const suggestion = operationNoteSuggestionText.parse(generated);
                stage = 'recheck_operation';
                const current = await deps.getOperation(input.operationId);
                if (
                    (current.status !== 'pendingVerification' &&
                        current.status !== 'completed') ||
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
            } catch (error) {
                console.warn('operation.note.suggestion.failed', {
                    operationId: input.operationId,
                    stage,
                    // AI SDK errors can carry request bodies containing the note
                    // and private context. Log diagnostic metadata, not raw errors.
                    error: {
                        name:
                            error instanceof Error
                                ? error.name
                                : 'UnknownError',
                        statusCode:
                            error &&
                            typeof error === 'object' &&
                            'statusCode' in error &&
                            typeof error.statusCode === 'number'
                                ? error.statusCode
                                : undefined,
                    },
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
