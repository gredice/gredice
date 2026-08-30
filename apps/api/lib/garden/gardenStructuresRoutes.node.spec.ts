import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createGardenStructureTemplateSeed,
    gardenStructureMaxIdentifierLength,
    gardenStructureMaxPayloadBytes,
} from '@gredice/js/gardenStructures';
import { Hono, type MiddlewareHandler } from 'hono';
import { hc } from 'hono/client';
import { openAPIRouteHandler } from 'hono-openapi';
import {
    createGardenStructuresRoutes,
    createTestAuthMiddleware,
    type GardenStructureRouteDeps,
} from '../../app/api/[...route]/gardenStructuresRoutes';
import type { AuthVariables } from '../hono/authValidator';
import {
    type CreateGardenStructureCommand,
    type DeleteGardenStructureCommand,
    type GardenStructureMutationResponse,
    GardenStructureServiceError,
    type GardenStructureServiceIssue,
    type ReplaceGardenStructureCommand,
    type UpdateGardenStructurePlacementCommand,
} from './gardenStructuresService';

const template = createGardenStructureTemplateSeed('house');

function mutationResponse(
    kind: GardenStructureMutationResponse['kind'],
): GardenStructureMutationResponse {
    return {
        economy: {
            debitedSunflowers: kind === 'create' ? 50 : 0,
            refundedSunflowers: kind === 'delete' ? 50 : 0,
        },
        kind,
        structure: {
            anchorX: 3,
            anchorY: -2,
            deleted: kind === 'delete',
            document: template.document,
            gardenId: 7,
            id: 'structure-1',
            kitKey: template.kitKey,
            kitVersion: template.kitVersion,
            pricingVersion: 1,
            refundableSunflowerPrincipal: kind === 'delete' ? 0 : 50,
            revision: 2,
            rotation: 1,
            sunflowerPricePerCell: 50,
            templateKey: template.templateKey,
        },
    };
}

function routeDeps(
    overrides: Partial<GardenStructureRouteDeps> = {},
): GardenStructureRouteDeps {
    return {
        authValidator: () =>
            createTestAuthMiddleware({ accountId: 'authenticated-account' }),
        createGardenStructureForAccount: async () => mutationResponse('create'),
        deleteGardenStructureForAccount: async () => mutationResponse('delete'),
        logUnexpectedError: () => undefined,
        replaceGardenStructureForAccount: async () =>
            mutationResponse('replace'),
        resizeGardenStructureForAccount: async () => mutationResponse('resize'),
        updateGardenStructurePlacementForAccount: async () =>
            mutationResponse('placement'),
        ...overrides,
    };
}

function createMountedApp(deps: GardenStructureRouteDeps = routeDeps()) {
    return new Hono<{ Variables: AuthVariables }>().route(
        '/:gardenId/structures',
        createGardenStructuresRoutes(deps),
    );
}

function jsonRequest(method: string, body: unknown) {
    return {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method,
    };
}

const createBody = {
    operationId: 'operation-create',
    structureId: 'structure-1',
    templateKey: template.templateKey,
    kitKey: template.kitKey,
    kitVersion: template.kitVersion,
    anchorX: 3,
    anchorY: -2,
    rotation: 1,
    document: template.document,
} satisfies Omit<CreateGardenStructureCommand, 'accountId' | 'gardenId'>;

const documentBody = {
    operationId: 'operation-document',
    expectedRevision: 4,
    document: template.document,
} satisfies Omit<
    ReplaceGardenStructureCommand,
    'accountId' | 'gardenId' | 'structureId'
>;

const placementBody = {
    operationId: 'operation-placement',
    expectedRevision: 5,
    anchorX: -4,
    anchorY: 8,
    rotation: 3,
} satisfies Omit<
    UpdateGardenStructurePlacementCommand,
    'accountId' | 'gardenId' | 'structureId'
>;

const deleteBody = {
    operationId: 'operation-delete',
    expectedRevision: 6,
} satisfies Omit<
    DeleteGardenStructureCommand,
    'accountId' | 'gardenId' | 'structureId'
>;

function typecheckInferredGardenStructureClient() {
    const client = hc<ReturnType<typeof createMountedApp>>(
        'https://api.gredice.test',
    );
    void client[':gardenId'].structures.$post({
        param: { gardenId: '7' },
        json: createBody,
    });
    void client[':gardenId'].structures[':structureId'].$put({
        param: { gardenId: '7', structureId: 'structure-1' },
        json: documentBody,
    });
    void client[':gardenId'].structures[':structureId'].resize.$post({
        param: { gardenId: '7', structureId: 'structure-1' },
        json: documentBody,
    });
    void client[':gardenId'].structures[':structureId'].placement.$patch({
        param: { gardenId: '7', structureId: 'structure-1' },
        json: placementBody,
    });
    void client[':gardenId'].structures[':structureId'].$delete({
        param: { gardenId: '7', structureId: 'structure-1' },
        json: deleteBody,
    });
}

void typecheckInferredGardenStructureClient;

test('garden structure routes map every HTTP command to the authenticated-account service', async () => {
    const calls: Array<{ mutation: string; command: unknown }> = [];
    const app = createMountedApp(
        routeDeps({
            createGardenStructureForAccount: async (command) => {
                calls.push({ mutation: 'create', command });
                return mutationResponse('create');
            },
            replaceGardenStructureForAccount: async (command) => {
                calls.push({ mutation: 'replace', command });
                return mutationResponse('replace');
            },
            resizeGardenStructureForAccount: async (command) => {
                calls.push({ mutation: 'resize', command });
                return mutationResponse('resize');
            },
            updateGardenStructurePlacementForAccount: async (command) => {
                calls.push({ mutation: 'placement', command });
                return mutationResponse('placement');
            },
            deleteGardenStructureForAccount: async (command) => {
                calls.push({ mutation: 'delete', command });
                return mutationResponse('delete');
            },
        }),
    );

    const requests = [
        app.request('/7/structures', jsonRequest('POST', createBody)),
        app.request(
            '/7/structures/structure-1',
            jsonRequest('PUT', documentBody),
        ),
        app.request(
            '/7/structures/structure-1/resize',
            jsonRequest('POST', {
                ...documentBody,
                operationId: 'operation-resize',
            }),
        ),
        app.request(
            '/7/structures/structure-1/placement',
            jsonRequest('PATCH', placementBody),
        ),
        app.request(
            '/7/structures/structure-1',
            jsonRequest('DELETE', deleteBody),
        ),
    ];
    const responses = await Promise.all(requests);

    assert.deepEqual(
        responses.map((response) => response.status),
        [201, 200, 200, 200, 200],
    );
    assert.deepEqual(
        await Promise.all(
            responses.map(async (response) => (await response.json()).kind),
        ),
        ['create', 'replace', 'resize', 'placement', 'delete'],
    );
    assert.deepEqual(calls, [
        {
            mutation: 'create',
            command: {
                accountId: 'authenticated-account',
                gardenId: 7,
                ...createBody,
            },
        },
        {
            mutation: 'replace',
            command: {
                accountId: 'authenticated-account',
                gardenId: 7,
                structureId: 'structure-1',
                ...documentBody,
            },
        },
        {
            mutation: 'resize',
            command: {
                accountId: 'authenticated-account',
                gardenId: 7,
                structureId: 'structure-1',
                ...documentBody,
                operationId: 'operation-resize',
            },
        },
        {
            mutation: 'placement',
            command: {
                accountId: 'authenticated-account',
                gardenId: 7,
                structureId: 'structure-1',
                ...placementBody,
            },
        },
        {
            mutation: 'delete',
            command: {
                accountId: 'authenticated-account',
                gardenId: 7,
                structureId: 'structure-1',
                ...deleteBody,
            },
        },
    ]);
});

test('garden docs expose every mounted structure mutation route', async () => {
    const { default: gardensRoutes } = await import(
        '../../app/api/[...route]/gardensRoutes'
    );
    const docsApp = new Hono().get(
        '/docs',
        openAPIRouteHandler(gardensRoutes, {
            documentation: {
                info: { title: 'Gardens API', version: '1.0.0' },
            },
        }),
    );

    const response = await docsApp.request('/docs');
    const document = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(
        Object.keys(document.paths)
            .filter((path) => path.includes('/structures'))
            .sort(),
        [
            '/{gardenId}/structures',
            '/{gardenId}/structures/{structureId}',
            '/{gardenId}/structures/{structureId}/placement',
            '/{gardenId}/structures/{structureId}/resize',
        ],
    );
    assert.ok(document.paths['/{gardenId}/structures'].post);
    assert.ok(document.paths['/{gardenId}/structures/{structureId}'].put);
    assert.ok(document.paths['/{gardenId}/structures/{structureId}'].delete);
    assert.ok(
        document.paths['/{gardenId}/structures/{structureId}/resize'].post,
    );
    assert.ok(
        document.paths['/{gardenId}/structures/{structureId}/placement'].patch,
    );
    const createSchema =
        document.paths['/{gardenId}/structures'].post.requestBody.content[
            'application/json'
        ].schema;
    assert.equal(createSchema.additionalProperties, false);
    assert.equal(
        createSchema.properties.document.properties.schemaVersion.const,
        1,
    );
    assert.equal(
        createSchema.properties.document.properties.footprint.properties.cells
            .maxItems,
        100,
    );
    assert.equal(
        createSchema.properties.document.properties.props.maxItems,
        100,
    );
    assert.equal(createSchema.properties.document.additionalProperties, false);
});

function unauthorizedAuth(): MiddlewareHandler<{
    Variables: AuthVariables;
}> {
    return async (context) => context.json({ error: 'Unauthorized' }, 401);
}

test('garden structure routes require user or admin authorization before service calls', async () => {
    const requestedRoles: string[][] = [];
    let serviceCallCount = 0;
    const blockedService = async () => {
        serviceCallCount += 1;
        return mutationResponse('create');
    };
    const app = createMountedApp(
        routeDeps({
            authValidator: (roles) => {
                requestedRoles.push([...roles]);
                return unauthorizedAuth();
            },
            createGardenStructureForAccount: blockedService,
            deleteGardenStructureForAccount: blockedService,
            replaceGardenStructureForAccount: blockedService,
            resizeGardenStructureForAccount: blockedService,
            updateGardenStructurePlacementForAccount: blockedService,
        }),
    );

    const responses = await Promise.all([
        app.request('/7/structures', jsonRequest('POST', createBody)),
        app.request(
            '/7/structures/structure-1',
            jsonRequest('PUT', documentBody),
        ),
        app.request(
            '/7/structures/structure-1/resize',
            jsonRequest('POST', documentBody),
        ),
        app.request(
            '/7/structures/structure-1/placement',
            jsonRequest('PATCH', placementBody),
        ),
        app.request(
            '/7/structures/structure-1',
            jsonRequest('DELETE', deleteBody),
        ),
    ]);

    assert.deepEqual(
        responses.map((response) => response.status),
        [401, 401, 401, 401, 401],
    );
    assert.equal(serviceCallCount, 0);
    assert.deepEqual(requestedRoles, [
        ['user', 'admin'],
        ['user', 'admin'],
        ['user', 'admin'],
        ['user', 'admin'],
        ['user', 'admin'],
    ]);
});

test('garden structure routes reject strict and oversized envelopes before service calls', async () => {
    let serviceCallCount = 0;
    const blockedService = async () => {
        serviceCallCount += 1;
        return mutationResponse('create');
    };
    const app = createMountedApp(
        routeDeps({
            createGardenStructureForAccount: blockedService,
            deleteGardenStructureForAccount: blockedService,
            replaceGardenStructureForAccount: blockedService,
            resizeGardenStructureForAccount: blockedService,
            updateGardenStructurePlacementForAccount: blockedService,
        }),
    );
    const invalidRequests = [
        app.request('/0/structures', jsonRequest('POST', createBody)),
        app.request(
            '/7/structures',
            jsonRequest('POST', { ...createBody, unexpected: true }),
        ),
        app.request(
            '/7/structures',
            jsonRequest('POST', { ...createBody, operationId: ' padded ' }),
        ),
        app.request(
            '/7/structures',
            jsonRequest('POST', {
                ...createBody,
                structureId: 'x'.repeat(gardenStructureMaxIdentifierLength + 1),
            }),
        ),
        app.request(
            '/7/structures',
            jsonRequest('POST', { ...createBody, rotation: 4 }),
        ),
        app.request(
            '/7/structures/structure-1',
            jsonRequest('PUT', { ...documentBody, expectedRevision: 0 }),
        ),
        app.request(
            '/7/structures/structure-1',
            jsonRequest('DELETE', { expectedRevision: 2 }),
        ),
        app.request(
            '/7/structures',
            jsonRequest('POST', {
                ...createBody,
                document: {
                    payload: 'x'.repeat(gardenStructureMaxPayloadBytes),
                },
            }),
        ),
        app.request(
            '/7/structures',
            jsonRequest('POST', {
                ...createBody,
                document: { ...template.document, schemaVersion: 2 },
            }),
        ),
        app.request(
            '/7/structures',
            jsonRequest('POST', {
                ...createBody,
                document: {
                    ...template.document,
                    footprint: {
                        cells: [
                            {
                                x: 0,
                                y: 0,
                                spaceKind: 'covered-outdoor',
                            },
                            {
                                x: 2,
                                y: 0,
                                spaceKind: 'covered-outdoor',
                            },
                        ],
                    },
                },
            }),
        ),
    ];
    const responses = await Promise.all(invalidRequests);

    assert.deepEqual(
        responses.map((response) => response.status),
        Array.from({ length: invalidRequests.length }, () => 400),
    );
    assert.equal(serviceCallCount, 0);
});

test('garden structure routes enforce raw request bytes before JSON parsing and service calls', async () => {
    let serviceCallCount = 0;
    const app = createMountedApp(
        routeDeps({
            createGardenStructureForAccount: async () => {
                serviceCallCount += 1;
                return mutationResponse('create');
            },
        }),
    );
    const serialized = JSON.stringify(createBody);
    const rawBody = `${' '.repeat(gardenStructureMaxPayloadBytes)}${serialized}`;

    const response = await app.request('/7/structures', {
        body: rawBody,
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });

    assert.ok(
        Buffer.byteLength(rawBody, 'utf8') > gardenStructureMaxPayloadBytes,
    );
    assert.equal(response.status, 400);
    assert.equal(serviceCallCount, 0);
});

test('garden structure routes preserve each typed service error status with bounded details', async (context) => {
    const issue = {
        code: 'c'.repeat(300),
        path: 'p'.repeat(300),
        severity: 'error',
    } satisfies GardenStructureServiceIssue;
    const errors = [
        new GardenStructureServiceError(
            'INVALID_REQUEST',
            400,
            'm'.repeat(700),
            { issues: Array.from({ length: 70 }, () => issue) },
        ),
        new GardenStructureServiceError(
            'GARDEN_NOT_FOUND',
            404,
            'Garden not found.',
        ),
        new GardenStructureServiceError(
            'REVISION_CONFLICT',
            409,
            'Garden structure revision no longer matches.',
            { currentRevision: 5, expectedRevision: 4 },
        ),
        new GardenStructureServiceError(
            'BUILDING_SYSTEM_DISABLED',
            503,
            'Garden building system is disabled.',
        ),
    ];

    for (const serviceError of errors) {
        await context.test(
            `maps ${serviceError.status.toString()}`,
            async () => {
                const app = createMountedApp(
                    routeDeps({
                        createGardenStructureForAccount: async () => {
                            throw serviceError;
                        },
                    }),
                );

                const response = await app.request(
                    '/7/structures',
                    jsonRequest('POST', createBody),
                );
                const body = await response.json();

                assert.equal(response.status, serviceError.status);
                assert.equal(body.code, serviceError.code);
                assert.equal(typeof body.details, 'object');
                assert.ok(body.error.length <= 512);
                if (serviceError.status === 400) {
                    assert.equal(body.details.issues.length, 64);
                    assert.equal(body.details.issues[0].code.length, 256);
                    assert.equal(body.details.issues[0].path.length, 256);
                }
                if (serviceError.status === 409) {
                    assert.deepEqual(body.details, {
                        currentRevision: 5,
                        expectedRevision: 4,
                    });
                }
            },
        );
    }
});

test('garden structure routes return a generic 500 without leaking unknown failures', async () => {
    const privateError = new Error('private-token-must-not-leak');
    const loggedContexts: Array<
        Parameters<GardenStructureRouteDeps['logUnexpectedError']>[0]
    > = [];
    const app = createMountedApp(
        routeDeps({
            createGardenStructureForAccount: async () => {
                throw privateError;
            },
            logUnexpectedError: (context) => {
                loggedContexts.push(context);
            },
        }),
    );

    const response = await app.request(
        '/7/structures',
        jsonRequest('POST', createBody),
    );
    const responseText = await response.text();

    assert.equal(response.status, 500);
    assert.deepEqual(JSON.parse(responseText), {
        error: 'Garden structure operation failed.',
    });
    assert.doesNotMatch(responseText, /private-token/);
    assert.deepEqual(loggedContexts, [
        {
            error: privateError,
            gardenId: 7,
            mutation: 'create',
            structureId: 'structure-1',
        },
    ]);
});
