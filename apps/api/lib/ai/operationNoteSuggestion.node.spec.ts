import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiOperationNotesRoutes } from '../../app/api/[...route]/aiOperationNotesRoutes';
import {
    buildOperationNoteContext,
    type NoteSuggestionOperation,
    operationNoteSuggestionInput,
    operationNoteSuggestionSystem,
} from './operationNoteSuggestion';

const operation: NoteSuggestionOperation = {
    id: 5089,
    entityId: 10,
    gardenId: null,
    raisedBedId: null,
    raisedBedFieldId: null,
    plantingId: null,
    status: 'pendingVerification',
    completedAt: new Date('2026-09-15T12:00:00Z'),
    taskVersionEventId: 20,
    completionNotes: 'rajcice vrh odrezat i oprat martine',
};
const context = buildOperationNoteContext({
    operation,
    raisedBed: null,
    garden: null,
    plantSorts: [],
    operations: [],
});
const input = {
    operationId: 5089,
    expectedTaskVersionEventId: 20,
    notes: operation.completionNotes,
    mode: 'automatic',
};

function setup({
    edited = false,
    authorized = true,
    version = 20,
    status = 'pendingVerification',
    result = 'Predlažemo uklanjanje vrhova rajčica.',
}: {
    edited?: boolean;
    authorized?: boolean;
    version?: number;
    status?: NoteSuggestionOperation['status'];
    result?: string;
} = {}) {
    const calls: string[] = [];
    let currentVersion = version;
    const routes = createAiOperationNotesRoutes({
        authValidator: (roles) => {
            assert.deepEqual(roles, ['admin']);
            return async (c, next) =>
                authorized ? next() : c.text('Unauthorized', 401);
        },
        getOperation: async () => {
            calls.push('operation');
            return {
                ...operation,
                status,
                completionNotesEdited: edited,
                taskVersionEventId: currentVersion,
            };
        },
        loadContext: async () => {
            calls.push('context');
            return context;
        },
        generate: async (notes, suppliedContext) => {
            calls.push('generate');
            assert.equal(notes, operation.completionNotes);
            assert.equal(suppliedContext, context);
            return result;
        },
    });
    return {
        calls,
        routes,
        changeVersion: () => {
            currentVersion++;
        },
        request: (payload: unknown = input) =>
            routes.request('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
    };
}

test('admin receives a contextual suggestion with no persistence', async () => {
    const fixture = setup();
    const response = await fixture.request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), {
        suggestion: 'Predlažemo uklanjanje vrhova rajčica.',
        skipped: false,
    });
    assert.deepEqual(fixture.calls, [
        'operation',
        'context',
        'generate',
        'operation',
    ]);
});

test('unauthenticated and non-admin callers cannot read context or generate', async () => {
    const fixture = setup({ authorized: false });
    assert.equal((await fixture.request()).status, 401);
    assert.deepEqual(fixture.calls, []);
});

test('edited notes skip automatic generation and allow a manual request', async () => {
    const fixture = setup({ edited: true });
    assert.deepEqual(await (await fixture.request()).json(), {
        suggestion: null,
        skipped: true,
    });
    assert.deepEqual(fixture.calls, ['operation']);
    assert.equal(
        (await fixture.request({ ...input, mode: 'manual' })).status,
        200,
    );
    assert.ok(fixture.calls.includes('generate'));
});

test('verified completion notes support both automatic and manual suggestions', async () => {
    const fixture = setup({ status: 'completed' });
    assert.equal((await fixture.request()).status, 200);
    const edited = setup({ status: 'completed', edited: true });
    assert.deepEqual(await (await edited.request()).json(), {
        suggestion: null,
        skipped: true,
    });
    assert.equal(
        (await edited.request({ ...input, mode: 'manual' })).status,
        200,
    );
});

test('a locally edited note is never automatically rewritten', async () => {
    const fixture = setup();
    assert.deepEqual(
        await (
            await fixture.request({ ...input, notes: 'Već uređena napomena.' })
        ).json(),
        { suggestion: null, skipped: true },
    );
    assert.deepEqual(fixture.calls, ['operation']);
});

test('rejects stale versions and operations without completion notes', async () => {
    for (const fixture of [
        setup({ version: 21 }),
        setup({ status: 'planned' }),
    ]) {
        assert.equal((await fixture.request()).status, 409);
        assert.deepEqual(fixture.calls, ['operation']);
    }
});

test('validates identifiers and full note length before reading data', async () => {
    const fixture = setup();
    for (const patch of [
        { operationId: -1 },
        { operationId: 1.1 },
        { expectedTaskVersionEventId: -1 },
        { notes: '' },
        { notes: 'x'.repeat(2001) },
        { mode: 'force' },
    ]) {
        assert.equal(
            (await fixture.request({ ...input, ...patch })).status,
            400,
        );
    }
    assert.deepEqual(fixture.calls, []);
    assert.equal(
        operationNoteSuggestionInput.parse({
            ...input,
            notes: 'x'.repeat(2000),
        }).notes.length,
        2000,
    );
});

test('empty and oversized model output cannot replace a note', async () => {
    for (const result of ['', 'x'.repeat(2001)]) {
        assert.equal((await setup({ result }).request()).status, 503);
    }
});

test('generation failures return a safe retryable error and sanitized diagnostics', async (t) => {
    const warnings: unknown[][] = [];
    t.mock.method(console, 'warn', (...args: unknown[]) => warnings.push(args));
    const routes = createAiOperationNotesRoutes({
        authValidator: () => async (_c, next) => next(),
        getOperation: async () => operation,
        loadContext: async () => context,
        generate: async () => {
            throw Object.assign(new Error('private provider details'), {
                statusCode: 429,
                requestBodyValues: { notes: 'private note' },
            });
        },
    });
    const response = await routes.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private provider/);
    assert.deepEqual(warnings, [
        [
            'operation.note.suggestion.failed',
            {
                operationId: 5089,
                stage: 'generate',
                error: { name: 'Error', statusCode: 429 },
            },
        ],
    ]);
    assert.doesNotMatch(JSON.stringify(warnings), /private|requestBodyValues/);
});

test('a changed version during generation discards the result', async () => {
    let version = 20;
    const routes = createAiOperationNotesRoutes({
        authValidator: () => async (_c, next) => next(),
        getOperation: async () => ({
            ...operation,
            taskVersionEventId: version,
        }),
        loadContext: async () => context,
        generate: async () => {
            version++;
            return 'Prijedlog';
        },
    });
    const response = await routes.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    });
    assert.equal(response.status, 409);
});

test('context uses a narrow projection and prompts preserve meaning and recommendations', () => {
    assert.deepEqual(Object.keys(context), [
        'operation',
        'garden',
        'raisedBed',
        'operationNames',
    ]);
    assert.doesNotMatch(
        JSON.stringify(context),
        /account|completedBy|image|email/,
    );
    assert.match(
        operationNoteSuggestionSystem,
        /izričito obavljeni rad ostaje obavljen/,
    );
    assert.match(operationNoteSuggestionSystem, /nikada upute/);
    assert.match(operationNoteSuggestionSystem, /Izbjegavaj naredbe/);
});

test('catalog grounding includes canonical names and scope without execution instructions', () => {
    const grounded = buildOperationNoteContext({
        operation,
        raisedBed: null,
        garden: { name: 'Povrtnjak' },
        plantSorts: [],
        operations: [
            {
                id: 10,
                information: {
                    name: 'inspect',
                    label: 'Detaljan pregled',
                    description: 'Full description',
                    shortDescription: 'x'.repeat(500),
                    instructions: 'Execution instructions must not be included',
                },
                attributes: {
                    internal: true,
                    application: 'raisedBedFull',
                    duration: 10,
                    deliverable: false,
                    stage: {
                        id: 1,
                        information: { name: 'all', label: 'Svi' },
                    },
                },
            },
        ],
    });
    assert.equal(grounded.operation.name, 'Detaljan pregled');
    assert.equal(grounded.garden?.name, 'Povrtnjak');
    assert.deepEqual(grounded.operationNames, [
        {
            name: 'Detaljan pregled',
            description: 'x'.repeat(300),
            internal: true,
            application: 'raisedBedFull',
        },
    ]);
    assert.doesNotMatch(
        JSON.stringify(grounded),
        /Execution instructions|Full description|duration/,
    );
});
