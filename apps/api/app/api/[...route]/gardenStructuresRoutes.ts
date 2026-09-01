import {
    decodeGardenStructureDocument,
    gardenStructureMaxCoordinateMagnitude,
    gardenStructureMaxEdges,
    gardenStructureMaxFootprintCells,
    gardenStructureMaxIdentifierLength,
    gardenStructureMaxPayloadBytes,
    gardenStructureMaxProps,
    gardenStructureMaxRoofRegions,
    getGardenStructurePayloadByteLength,
} from '@gredice/js/gardenStructures';
import { type Context, Hono, type MiddlewareHandler, type Next } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { authSecurity } from '../../../lib/docs/security';
import {
    createGardenStructureForAccount,
    deleteGardenStructureForAccount,
    GardenStructureServiceError,
    type GardenStructureServiceErrorDetails,
    replaceGardenStructureForAccount,
    resizeGardenStructureForAccount,
    updateGardenStructurePlacementForAccount,
} from '../../../lib/garden/gardenStructuresService';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const gardenIdSchema = z
    .string()
    .min(1)
    .max(16)
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));

const identifierSchema = z
    .string()
    .min(1)
    .max(gardenStructureMaxIdentifierLength)
    .refine((value) => value.trim() === value, {
        message: 'Identifiers must not have leading or trailing whitespace.',
    });

const coordinateSchema = z
    .number()
    .int()
    .min(-gardenStructureMaxCoordinateMagnitude)
    .max(gardenStructureMaxCoordinateMagnitude);

const positiveRevisionSchema = z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER);

const rotationSchema = z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
]);

const structureCoordinateSchema = z
    .object({
        x: coordinateSchema,
        y: coordinateSchema,
    })
    .strict();

const structureDocumentShapeSchema = z
    .object({
        schemaVersion: z.literal(1),
        footprint: z
            .object({
                cells: z
                    .array(
                        z
                            .object({
                                x: coordinateSchema,
                                y: coordinateSchema,
                                spaceKind: z.enum([
                                    'interior',
                                    'covered-outdoor',
                                ]),
                            })
                            .strict(),
                    )
                    .min(1)
                    .max(gardenStructureMaxFootprintCells)
                    .readonly()
                    .meta({ readOnly: false }),
            })
            .strict(),
        floors: z
            .array(
                z
                    .object({
                        cell: structureCoordinateSchema,
                        materialId: identifierSchema,
                    })
                    .strict(),
            )
            .max(gardenStructureMaxFootprintCells)
            .readonly()
            .meta({ readOnly: false }),
        edges: z
            .array(
                z
                    .object({
                        id: identifierSchema,
                        from: structureCoordinateSchema,
                        direction: z.enum(['north', 'east']),
                        partId: identifierSchema,
                        kind: z.enum(['wall', 'door', 'window']),
                    })
                    .strict(),
            )
            .max(gardenStructureMaxEdges)
            .readonly()
            .meta({ readOnly: false }),
        roofRegions: z
            .array(
                z
                    .object({
                        id: identifierSchema,
                        cells: z
                            .array(structureCoordinateSchema)
                            .min(1)
                            .max(gardenStructureMaxFootprintCells)
                            .readonly()
                            .meta({ readOnly: false }),
                        styleId: identifierSchema,
                        materialId: identifierSchema,
                        rotation: rotationSchema,
                    })
                    .strict(),
            )
            .max(gardenStructureMaxRoofRegions)
            .readonly()
            .meta({ readOnly: false }),
        props: z
            .array(
                z
                    .object({
                        id: identifierSchema,
                        partId: identifierSchema,
                        x: coordinateSchema,
                        y: coordinateSchema,
                        rotation: rotationSchema,
                        variantId: identifierSchema.optional(),
                    })
                    .strict(),
            )
            .max(gardenStructureMaxProps)
            .readonly()
            .meta({ readOnly: false }),
    })
    .strict();

function validationIssuePath(path: string): Array<string | number> {
    if (!path) return [];
    return path.split('.').flatMap((segment) => {
        const match = /^([^[]+)(?:\[(\d+)\])?$/.exec(segment);
        if (!match) return [segment];
        const [, key, index] = match;
        return index === undefined ? [key] : [key, Number(index)];
    });
}

const documentSchema = structureDocumentShapeSchema.superRefine(
    (document, context) => {
        const decoded = decodeGardenStructureDocument(document);
        if (decoded.valid) return;
        for (const issue of decoded.issues) {
            context.addIssue({
                code: 'custom',
                message: issue.message,
                path: validationIssuePath(issue.path),
            });
        }
    },
);

function enforcePayloadByteLimit(value: unknown, context: z.RefinementCtx) {
    const byteLength = getGardenStructurePayloadByteLength(value);
    if (byteLength === null || byteLength > gardenStructureMaxPayloadBytes) {
        context.addIssue({
            code: 'custom',
            message: `Garden structure commands may use at most ${gardenStructureMaxPayloadBytes.toString()} UTF-8 bytes.`,
        });
    }
}

const createBodySchema = z
    .object({
        operationId: identifierSchema,
        structureId: identifierSchema,
        templateKey: z.enum(['barn', 'house', 'greenhouse', 'blank']),
        kitKey: identifierSchema,
        kitVersion: identifierSchema,
        anchorX: coordinateSchema,
        anchorY: coordinateSchema,
        rotation: rotationSchema,
        document: documentSchema,
    })
    .strict()
    .superRefine(enforcePayloadByteLimit);

const documentMutationBodySchema = z
    .object({
        operationId: identifierSchema,
        expectedRevision: positiveRevisionSchema,
        document: documentSchema,
    })
    .strict()
    .superRefine(enforcePayloadByteLimit);

const resizeBodySchema = z
    .object({
        operationId: identifierSchema,
        expectedRevision: positiveRevisionSchema,
        anchorX: coordinateSchema,
        anchorY: coordinateSchema,
        rotation: rotationSchema,
        document: documentSchema,
    })
    .strict()
    .superRefine(enforcePayloadByteLimit);

const placementBodySchema = z
    .object({
        operationId: identifierSchema,
        expectedRevision: positiveRevisionSchema,
        anchorX: coordinateSchema,
        anchorY: coordinateSchema,
        rotation: rotationSchema,
    })
    .strict()
    .superRefine(enforcePayloadByteLimit);

const deleteBodySchema = z
    .object({
        operationId: identifierSchema,
        expectedRevision: positiveRevisionSchema,
    })
    .strict()
    .superRefine(enforcePayloadByteLimit);

const gardenParamSchema = z
    .object({
        gardenId: gardenIdSchema,
    })
    .strict();

const gardenStructureParamSchema = z
    .object({
        gardenId: gardenIdSchema,
        structureId: identifierSchema,
    })
    .strict();

const payloadLimitError = {
    error: `Garden structure commands may use at most ${gardenStructureMaxPayloadBytes.toString()} request bytes.`,
} as const;

const enforceRawPayloadByteLimit: MiddlewareHandler<{
    Variables: AuthVariables;
}> = async (context, next) => {
    const contentLength = context.req.header('content-length');
    if (
        contentLength &&
        /^\d+$/.test(contentLength) &&
        Number(contentLength) > gardenStructureMaxPayloadBytes
    ) {
        return context.json(payloadLimitError, 400);
    }

    const rawBody = await context.req.arrayBuffer();
    if (rawBody.byteLength > gardenStructureMaxPayloadBytes) {
        return context.json(payloadLimitError, 400);
    }

    await next();
};

type GardenStructureAuthValidator = (
    roles: string[],
) => MiddlewareHandler<{ Variables: AuthVariables }>;

type GardenStructureMutationName =
    | 'create'
    | 'delete'
    | 'placement'
    | 'replace'
    | 'resize';

export type GardenStructureRouteDeps = {
    authValidator: GardenStructureAuthValidator;
    createGardenStructureForAccount: typeof createGardenStructureForAccount;
    deleteGardenStructureForAccount: typeof deleteGardenStructureForAccount;
    logUnexpectedError: (context: {
        error: unknown;
        gardenId: number;
        mutation: GardenStructureMutationName;
        structureId: string;
    }) => void;
    replaceGardenStructureForAccount: typeof replaceGardenStructureForAccount;
    resizeGardenStructureForAccount: typeof resizeGardenStructureForAccount;
    updateGardenStructurePlacementForAccount: typeof updateGardenStructurePlacementForAccount;
};

const defaultDeps: GardenStructureRouteDeps = {
    authValidator,
    createGardenStructureForAccount,
    deleteGardenStructureForAccount,
    logUnexpectedError(context) {
        console.error('Garden structure mutation route failed', context);
    },
    replaceGardenStructureForAccount,
    resizeGardenStructureForAccount,
    updateGardenStructurePlacementForAccount,
};

const routeErrorMessageMaxLength = 512;
const routeErrorIssueMaxCount = 64;
const routeErrorIssueValueMaxLength = 256;

type BoundedGardenStructureErrorDetails = {
    availableSunflowers?: number;
    currentRevision?: number;
    expectedRevision?: number;
    issues?: Array<{
        code: string;
        path: string;
        severity?: 'error' | 'warning';
    }>;
    requiredSunflowers?: number;
};

type MutationFailure =
    | {
          body: {
              code: GardenStructureServiceError['code'];
              details: BoundedGardenStructureErrorDetails;
              error: string;
          };
          status: GardenStructureServiceError['status'];
      }
    | {
          body: { error: string };
          status: 500;
      };

function copySafeInteger(
    target: BoundedGardenStructureErrorDetails,
    key: Extract<
        keyof BoundedGardenStructureErrorDetails,
        | 'availableSunflowers'
        | 'currentRevision'
        | 'expectedRevision'
        | 'requiredSunflowers'
    >,
    value: number | undefined,
) {
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
        target[key] = value;
    }
}

function boundedErrorDetails(
    details: GardenStructureServiceErrorDetails,
): BoundedGardenStructureErrorDetails {
    const bounded: BoundedGardenStructureErrorDetails = {};
    copySafeInteger(
        bounded,
        'availableSunflowers',
        details.availableSunflowers,
    );
    copySafeInteger(bounded, 'currentRevision', details.currentRevision);
    copySafeInteger(bounded, 'expectedRevision', details.expectedRevision);
    copySafeInteger(bounded, 'requiredSunflowers', details.requiredSunflowers);
    if (details.issues) {
        bounded.issues = details.issues
            .slice(0, routeErrorIssueMaxCount)
            .map((issue) => ({
                code: issue.code.slice(0, routeErrorIssueValueMaxLength),
                path: issue.path.slice(0, routeErrorIssueValueMaxLength),
                ...(issue.severity === 'error' || issue.severity === 'warning'
                    ? { severity: issue.severity }
                    : {}),
            }));
    }
    return bounded;
}

function mutationFailure(
    error: unknown,
    mutation: GardenStructureMutationName,
    deps: GardenStructureRouteDeps,
    context: { gardenId: number; structureId: string },
): MutationFailure {
    if (error instanceof GardenStructureServiceError) {
        return {
            body: {
                error:
                    error.message.slice(0, routeErrorMessageMaxLength) ||
                    'Garden structure request failed.',
                code: error.code,
                details: boundedErrorDetails(error.details),
            },
            status: error.status,
        };
    }

    deps.logUnexpectedError({ error, mutation, ...context });
    return {
        body: { error: 'Garden structure operation failed.' },
        status: 500,
    };
}

const sharedErrorResponses = {
    400: { description: 'The command is invalid' },
    401: { description: 'Authentication is required' },
    404: { description: 'The garden or structure was not found' },
    409: { description: 'The command conflicts with current state' },
    500: { description: 'The command failed unexpectedly' },
    503: { description: 'The building system is temporarily unavailable' },
};

export function createGardenStructuresRoutes(
    deps: GardenStructureRouteDeps = defaultDeps,
) {
    return new Hono<{ Variables: AuthVariables }>()
        .post(
            '/',
            describeRoute({
                description:
                    'Create a garden structure for the current authenticated account.',
                security: authSecurity,
                tags: ['Gardens'],
                responses: {
                    201: { description: 'The structure was created' },
                    ...sharedErrorResponses,
                },
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('param', gardenParamSchema),
            enforceRawPayloadByteLimit,
            zValidator('json', createBodySchema),
            async (context) => {
                const { gardenId } = context.req.valid('param');
                const body = context.req.valid('json');
                const { accountId } = context.get('authContext');

                try {
                    const result = await deps.createGardenStructureForAccount({
                        accountId,
                        gardenId,
                        ...body,
                    });
                    return context.json(result, 201);
                } catch (error) {
                    const failure = mutationFailure(error, 'create', deps, {
                        gardenId,
                        structureId: body.structureId,
                    });
                    return context.json(failure.body, failure.status);
                }
            },
        )
        .put(
            '/:structureId',
            describeRoute({
                description:
                    'Replace a garden structure document without changing its footprint.',
                security: authSecurity,
                tags: ['Gardens'],
                responses: {
                    200: { description: 'The structure document was replaced' },
                    ...sharedErrorResponses,
                },
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('param', gardenStructureParamSchema),
            enforceRawPayloadByteLimit,
            zValidator('json', documentMutationBodySchema),
            async (context) => {
                const { gardenId, structureId } = context.req.valid('param');
                const body = context.req.valid('json');
                const { accountId } = context.get('authContext');

                try {
                    const result = await deps.replaceGardenStructureForAccount({
                        accountId,
                        gardenId,
                        structureId,
                        ...body,
                    });
                    return context.json(result, 200);
                } catch (error) {
                    const failure = mutationFailure(error, 'replace', deps, {
                        gardenId,
                        structureId,
                    });
                    return context.json(failure.body, failure.status);
                }
            },
        )
        .post(
            '/:structureId/resize',
            describeRoute({
                description:
                    'Resize a garden structure by persisting its complete candidate document and placement atomically.',
                security: authSecurity,
                tags: ['Gardens'],
                responses: {
                    200: { description: 'The structure was resized' },
                    ...sharedErrorResponses,
                },
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('param', gardenStructureParamSchema),
            enforceRawPayloadByteLimit,
            zValidator('json', resizeBodySchema),
            async (context) => {
                const { gardenId, structureId } = context.req.valid('param');
                const body = context.req.valid('json');
                const { accountId } = context.get('authContext');

                try {
                    const result = await deps.resizeGardenStructureForAccount({
                        accountId,
                        gardenId,
                        structureId,
                        ...body,
                    });
                    return context.json(result, 200);
                } catch (error) {
                    const failure = mutationFailure(error, 'resize', deps, {
                        gardenId,
                        structureId,
                    });
                    return context.json(failure.body, failure.status);
                }
            },
        )
        .patch(
            '/:structureId/placement',
            describeRoute({
                description: 'Move or rotate a garden structure atomically.',
                security: authSecurity,
                tags: ['Gardens'],
                responses: {
                    200: { description: 'The structure placement was updated' },
                    ...sharedErrorResponses,
                },
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('param', gardenStructureParamSchema),
            enforceRawPayloadByteLimit,
            zValidator('json', placementBodySchema),
            async (context) => {
                const { gardenId, structureId } = context.req.valid('param');
                const body = context.req.valid('json');
                const { accountId } = context.get('authContext');

                try {
                    const result =
                        await deps.updateGardenStructurePlacementForAccount({
                            accountId,
                            gardenId,
                            structureId,
                            ...body,
                        });
                    return context.json(result, 200);
                } catch (error) {
                    const failure = mutationFailure(error, 'placement', deps, {
                        gardenId,
                        structureId,
                    });
                    return context.json(failure.body, failure.status);
                }
            },
        )
        .delete(
            '/:structureId',
            describeRoute({
                description:
                    'Soft-delete a garden structure and apply its authorized refund.',
                security: authSecurity,
                tags: ['Gardens'],
                responses: {
                    200: { description: 'The structure was deleted' },
                    ...sharedErrorResponses,
                },
            }),
            deps.authValidator(['user', 'admin']),
            zValidator('param', gardenStructureParamSchema),
            enforceRawPayloadByteLimit,
            zValidator('json', deleteBodySchema),
            async (context) => {
                const { gardenId, structureId } = context.req.valid('param');
                const body = context.req.valid('json');
                const { accountId } = context.get('authContext');

                try {
                    const result = await deps.deleteGardenStructureForAccount({
                        accountId,
                        gardenId,
                        structureId,
                        ...body,
                    });
                    return context.json(result, 200);
                } catch (error) {
                    const failure = mutationFailure(error, 'delete', deps, {
                        gardenId,
                        structureId,
                    });
                    return context.json(failure.body, failure.status);
                }
            },
        );
}

export function createTestAuthMiddleware({
    accountId = 'test-account',
    userId = 'test-user',
}: {
    accountId?: string;
    userId?: string;
} = {}) {
    return async (
        context: Context<{ Variables: AuthVariables }>,
        next: Next,
    ) => {
        context.set('authContext', {
            accountId,
            userId,
            user: {
                id: userId,
                accountIds: [accountId],
                isTemporary: false,
                role: 'user',
            },
        });

        await next();
    };
}

export default createGardenStructuresRoutes();
