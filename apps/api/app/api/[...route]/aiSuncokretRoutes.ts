import { suncokretSettingsSections, suncokretUiSurfaces } from '@gredice/js/ai';
import {
    aiChatRetryAtIso,
    ensureAiChatConversation,
    finalizeAiChatUsage,
    getAiChatAccountLimitState,
    getGarden,
    getRaisedBed,
    releaseAiChatUsageReservation,
    replaceAiChatMessages,
    reserveAiChatUsage,
} from '@gredice/storage';
import {
    consumeStream,
    convertToModelMessages,
    gateway,
    type LanguageModelUsage,
    stepCountIs,
    streamText,
    tool,
    type UIMessage,
} from 'ai';
import { Hono } from 'hono';
import { describeRoute, validator as zValidator } from 'hono-openapi';
import { z } from 'zod';
import { buildSuncokretSystemPrompt } from '../../../lib/ai/suncokretContext';
import {
    estimateSuncokretPromptTokens,
    estimateSuncokretRequestCostMicroUsd,
    getSuncokretModel,
    getSuncokretModelRegistry,
    resolveSuncokretMaxOutputTokens,
} from '../../../lib/ai/suncokretModels';
import { createJwt } from '../../../lib/auth/auth';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const MIN_OUTPUT_TOKENS = 128;
const MAX_CONTEXT_MESSAGES = 24;
const MAX_IMAGE_URLS_PER_ANALYSIS = 6;

type ChatVariables = AuthVariables;

const FeatureFlagsSchema = z.object({
    enableSuncokretChatFlag: z.boolean().optional().default(false),
    enableSuncokretDebugFlag: z.boolean().optional().default(false),
});

const ChatBodySchema = z.object({
    id: z.string().optional(),
    conversationId: z.string().optional(),
    messages: z.array(z.unknown()).min(1).max(80),
    gardenId: z.number().int().positive().optional().nullable(),
    raisedBedId: z.number().int().positive().optional().nullable(),
    positionIndex: z.number().int().min(0).optional().nullable(),
    modelId: z.string().trim().min(1).optional().nullable(),
    uiContext: z
        .object({
            surface: z.enum(suncokretUiSurfaces),
            section: z.enum(suncokretSettingsSections).optional().nullable(),
        })
        .optional()
        .nullable(),
    debug: z.boolean().optional(),
    featureFlags: FeatureFlagsSchema.optional().default({
        enableSuncokretChatFlag: false,
        enableSuncokretDebugFlag: false,
    }),
});

const StatusQuerySchema = z.object({
    modelId: z.string().optional(),
    enableSuncokretChatFlag: z.string().optional(),
    enableSuncokretDebugFlag: z.string().optional(),
});

function booleanFlag(value: string | undefined) {
    return ['1', 'true', 'yes', 'on'].includes(value?.toLowerCase() ?? '');
}

function queryFeatureFlags(query: z.infer<typeof StatusQuerySchema>) {
    return {
        enableSuncokretChatFlag: booleanFlag(query.enableSuncokretChatFlag),
        enableSuncokretDebugFlag: booleanFlag(query.enableSuncokretDebugFlag),
    };
}

function microUsdToUsd(value: number) {
    return value / 1_000_000;
}

function jsonError(
    code: string,
    message: string,
    status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
    details?: Record<string, unknown>,
) {
    return {
        body: {
            code,
            error: message,
            ...details,
        },
        status,
    };
}

function enabledOrResponse(flags: z.infer<typeof FeatureFlagsSchema>) {
    if (flags.enableSuncokretChatFlag) {
        return null;
    }

    return jsonError(
        'ai_feature_disabled',
        'Suncokret chat trenutno nije omogućen.',
        403,
    );
}

function usageTokens(usage: LanguageModelUsage | undefined) {
    return {
        inputTokens: usage?.inputTokens ?? 0,
        outputTokens: usage?.outputTokens ?? 0,
        totalTokens:
            usage?.totalTokens ??
            (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
    };
}

function getConversationId(body: z.infer<typeof ChatBodySchema>) {
    return (
        body.conversationId?.trim() || body.id?.trim() || crypto.randomUUID()
    );
}

async function validateGardenContext({
    accountId,
    gardenId,
    raisedBedId,
}: {
    accountId: string;
    gardenId?: number | null;
    raisedBedId?: number | null;
}) {
    const [requestedGarden, raisedBed] = await Promise.all([
        gardenId ? getGarden(gardenId) : null,
        raisedBedId ? getRaisedBed(raisedBedId) : null,
    ]);

    if (
        gardenId &&
        (!requestedGarden || requestedGarden.accountId !== accountId)
    ) {
        return { allowed: false as const };
    }

    if (raisedBedId) {
        if (
            !raisedBed ||
            raisedBed.accountId !== accountId ||
            (gardenId && raisedBed.gardenId !== gardenId)
        ) {
            return { allowed: false as const };
        }
    }

    let garden = requestedGarden;
    if (!garden && raisedBed?.gardenId) {
        garden = await getGarden(raisedBed.gardenId);
        if (!garden || garden.accountId !== accountId) {
            return { allowed: false as const };
        }
    }

    return {
        allowed: true as const,
        garden,
        raisedBed,
    };
}

function finalAnswerSystemPrompt(baseSystem: string) {
    return [
        baseSystem,
        'Sada više ne koristi alate. Napiši završni odgovor korisniku iz već dohvaćenih podataka. Ako neki podatak nedostaje, reci to kratko i svejedno daj najbolji praktični plan iz dostupnog konteksta.',
    ].join('\n\n');
}

async function mcpToken(userId: string, accountId: string) {
    return createJwt({ sub: userId, accountId }, '72h');
}

async function callMcpTool({
    accountId,
    args,
    name,
    origin,
    token,
}: {
    accountId: string;
    args: Record<string, unknown>;
    name: string;
    origin: string;
    token: string;
}) {
    const response = await fetch(`${origin}/api/mcp`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'x-gredice-account-id': accountId,
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: crypto.randomUUID(),
            method: 'tools/call',
            params: {
                name,
                arguments: args,
            },
        }),
    });
    const payload = (await response.json()) as {
        result?: unknown;
        error?: { message?: string };
    };

    if (!response.ok || payload.error) {
        throw new Error(payload.error?.message ?? `MCP tool ${name} failed`);
    }

    return payload.result;
}

async function callRaisedBedImageAnalysis({
    accountId,
    gardenId,
    imageUrls,
    origin,
    raisedBedId,
    token,
}: {
    accountId: string;
    gardenId: number;
    imageUrls: string[];
    origin: string;
    raisedBedId: number;
    token: string;
}) {
    const response = await fetch(
        `${origin}/api/gardens/${gardenId.toString()}/raised-beds/${raisedBedId.toString()}/analyze-image`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Cookie: `gredice_account=${encodeURIComponent(accountId)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageUrls }),
        },
    );

    if (!response.ok) {
        let message = 'Analiza fotografija nije uspjela.';
        try {
            const payload = (await response.json()) as { error?: string };
            message = payload.error ?? message;
        } catch {
            message = await response.text();
        }
        throw new Error(message);
    }

    return {
        markdown: await response.text(),
        imageUrls,
    };
}

function buildTools({
    accountId,
    contextGardenId,
    contextRaisedBedId,
    origin,
    token,
    userId,
}: {
    accountId: string;
    contextGardenId?: number | null;
    contextRaisedBedId?: number | null;
    origin: string;
    token: string;
    userId: string;
}) {
    const mcp = (name: string, args: Record<string, unknown>) =>
        callMcpTool({ accountId, args, name, origin, token });

    return {
        listGardens: tool({
            description: 'Dohvati vrtove za trenutni Gredice račun.',
            inputSchema: z.object({
                limit: z.number().int().min(1).max(20).default(10),
            }),
            execute: ({ limit }) =>
                mcp('gardens/list-gardens', { limit, offset: 0 }),
        }),
        listRaisedBeds: tool({
            description: 'Dohvati gredice za vrt.',
            inputSchema: z.object({
                gardenId: z.number().int().positive().optional(),
            }),
            execute: ({ gardenId }) =>
                mcp('gardens/list-raised-beds', {
                    gardenId: gardenId ?? contextGardenId,
                }),
        }),
        getRaisedBedFields: tool({
            description: 'Dohvati polja, biljke i status jedne gredice.',
            inputSchema: z.object({
                gardenId: z.number().int().positive().optional(),
                raisedBedId: z.number().int().positive().optional(),
            }),
            execute: ({ gardenId, raisedBedId }) =>
                mcp('gardens/get-raised-bed-fields', {
                    gardenId: gardenId ?? contextGardenId,
                    raisedBedId: raisedBedId ?? contextRaisedBedId,
                }),
        }),
        listGardenOperations: tool({
            description: 'Dohvati radnje za vrt ili gredicu.',
            inputSchema: z.object({
                gardenId: z.number().int().positive().optional(),
                raisedBedId: z.number().int().positive().optional(),
                limit: z.number().int().min(1).max(30).default(12),
            }),
            execute: ({ gardenId, limit, raisedBedId }) =>
                mcp('gardens/list-operations', {
                    gardenId: gardenId ?? contextGardenId,
                    raisedBedId: raisedBedId ?? contextRaisedBedId,
                    limit,
                    offset: 0,
                }),
        }),
        getRaisedBedAiHistory: tool({
            description: 'Dohvati već spremljene AI savjete za gredicu.',
            inputSchema: z.object({
                gardenId: z.number().int().positive().optional(),
                raisedBedId: z.number().int().positive().optional(),
                limit: z.number().int().min(1).max(10).default(5),
            }),
            execute: ({ gardenId, limit, raisedBedId }) =>
                mcp('gardens/get-raised-bed-ai-history', {
                    gardenId: gardenId ?? contextGardenId,
                    raisedBedId: raisedBedId ?? contextRaisedBedId,
                    limit,
                }),
        }),
        searchDirectory: tool({
            description: 'Pretraži Gredice katalog biljaka, sorti i radnji.',
            inputSchema: z.object({
                query: z.string().min(1),
                entityTypes: z.array(z.string()).optional(),
                limit: z.number().int().min(1).max(20).default(8),
            }),
            execute: (input) => mcp('directories/search-entities', input),
        }),
        getOperationsDirectory: tool({
            description: 'Dohvati katalog dostupnih vrtlarskih radnji.',
            inputSchema: z.object({
                category: z.string().optional(),
                limit: z.number().int().min(1).max(30).default(12),
            }),
            execute: ({ category, limit }) =>
                mcp('directories/get-operations', {
                    category,
                    limit,
                    offset: 0,
                }),
        }),
        searchProducts: tool({
            description: 'Pretraži proizvode koje je moguće dodati u košaricu.',
            inputSchema: z.object({
                query: z.string().optional(),
                limit: z.number().int().min(1).max(20).default(8),
            }),
            execute: ({ limit, query }) =>
                mcp('commerce/search-products', { query, limit, offset: 0 }),
        }),
        getCart: tool({
            description: 'Dohvati trenutnu košaricu korisnika.',
            inputSchema: z.object({}),
            execute: () => mcp('commerce/get-cart', { userId }),
        }),
        addProductToCart: tool({
            description:
                'Dodaj proizvod u košaricu. Uvijek treba odobrenje korisnika.',
            inputSchema: z.object({
                productId: z.string().min(1),
                quantity: z.number().positive().default(1),
                gardenId: z.number().int().positive().optional(),
                raisedBedId: z.number().int().positive().optional(),
                positionIndex: z.number().int().min(0).optional(),
                scheduledDate: z.string().optional(),
            }),
            needsApproval: true,
            execute: (input) =>
                mcp('commerce/add-to-cart', { ...input, userId }),
        }),
        updateCartItem: tool({
            description:
                'Promijeni ili ukloni stavku košarice. Uvijek treba odobrenje korisnika.',
            inputSchema: z.object({
                cartItemId: z.number().int().positive(),
                quantity: z.number().min(0),
            }),
            needsApproval: true,
            execute: (input) =>
                mcp('commerce/update-cart-item', { ...input, userId }),
        }),
        analyzeRaisedBedImages: tool({
            description:
                'Pokreni postojeću AI analizu fotografija gredice i vrati spremljene savjete.',
            inputSchema: z.object({
                gardenId: z.number().int().positive().optional(),
                raisedBedId: z.number().int().positive().optional(),
                imageUrls: z
                    .array(z.url())
                    .min(1)
                    .max(MAX_IMAGE_URLS_PER_ANALYSIS),
            }),
            execute: ({ gardenId, imageUrls, raisedBedId }) => {
                const finalGardenId = gardenId ?? contextGardenId;
                const finalRaisedBedId = raisedBedId ?? contextRaisedBedId;
                if (!finalGardenId || !finalRaisedBedId) {
                    throw new Error(
                        'Za analizu fotografija potrebna je odabrana gredica.',
                    );
                }

                return callRaisedBedImageAnalysis({
                    accountId,
                    gardenId: finalGardenId,
                    imageUrls,
                    origin,
                    raisedBedId: finalRaisedBedId,
                    token,
                });
            },
        }),
        prepareCheckout: tool({
            description:
                'Pripremi korisnika za checkout. Uvijek treba odobrenje korisnika.',
            inputSchema: z.object({}),
            needsApproval: true,
            execute: () => ({
                requiresUserAction: true,
                message:
                    'Checkout se dovršava u standardnom Gredice checkout toku. Otvori košaricu i potvrdi plaćanje tamo.',
            }),
        }),
    };
}

const app = new Hono<{ Variables: ChatVariables }>()
    .get(
        '/status',
        describeRoute({
            description: 'Get Suncokret AI chat budget status',
            security: authSecurity,
        }),
        zValidator('query', StatusQuerySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const query = context.req.valid('query');
            const featureFlags = queryFeatureFlags(query);
            const disabled = enabledOrResponse(featureFlags);
            const { accountId } = context.get('authContext');
            const model = getSuncokretModel(query.modelId);
            const limitState = await getAiChatAccountLimitState(accountId);

            const budget = featureFlags.enableSuncokretDebugFlag
                ? {
                      dailyLimitUsd: microUsdToUsd(
                          limitState.dailyLimitMicroUsd,
                      ),
                      usedUsd: microUsdToUsd(limitState.usedMicroUsd),
                      reservedUsd: microUsdToUsd(limitState.reservedMicroUsd),
                      remainingUsd: microUsdToUsd(limitState.remainingMicroUsd),
                  }
                : undefined;

            return context.json({
                enabled: !disabled,
                debugEnabled: featureFlags.enableSuncokretDebugFlag,
                model: model
                    ? {
                          id: model.id,
                          label: model.label,
                      }
                    : null,
                limit: {
                    retryAt: limitState.retryAt,
                    blockedReason: limitState.blockedReason,
                    trialChatDaysUsed: limitState.trialChatDaysUsed,
                    trialChatDaysLimit: limitState.trialChatDaysLimit,
                    usedInputTokens: limitState.usedInputTokens,
                    usedOutputTokens: limitState.usedOutputTokens,
                    usedTotalTokens: limitState.usedTotalTokens,
                },
                budget,
            });
        },
    )
    .get(
        '/models',
        describeRoute({
            description: 'List enabled Suncokret AI Gateway models',
            security: authSecurity,
        }),
        zValidator('query', StatusQuerySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const featureFlags = queryFeatureFlags(context.req.valid('query'));
            const disabled = enabledOrResponse(featureFlags);
            if (disabled) {
                return context.json(disabled.body, disabled.status);
            }

            return context.json({
                models: getSuncokretModelRegistry()
                    .filter((model) => model.enabled)
                    .map((model) => ({
                        id: model.id,
                        label: model.label,
                    })),
            });
        },
    )
    .post(
        '/chat',
        describeRoute({
            description: 'Stream an authenticated Suncokret AI chat response',
            security: authSecurity,
        }),
        zValidator('json', ChatBodySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const body = context.req.valid('json');
            const disabled = enabledOrResponse(body.featureFlags);
            if (disabled) {
                return context.json(disabled.body, disabled.status);
            }

            const debugAllowed = Boolean(
                body.debug && body.featureFlags.enableSuncokretDebugFlag,
            );
            const auth = context.get('authContext');
            const model = getSuncokretModel(body.modelId);
            if (!model) {
                const error = jsonError(
                    'ai_model_unavailable',
                    'Odabrani AI model nije dostupan ili nema postavljenu cijenu.',
                    400,
                );
                return context.json(error.body, error.status);
            }

            const gardenContext = await validateGardenContext({
                accountId: auth.accountId,
                gardenId: body.gardenId,
                raisedBedId: body.raisedBedId,
            });
            if (!gardenContext.allowed) {
                const error = jsonError(
                    'ai_context_forbidden',
                    'Odabrani vrt ili gredica nisu dostupni trenutnom računu.',
                    403,
                );
                return context.json(error.body, error.status);
            }

            const conversationId = getConversationId(body);
            const conversation = await ensureAiChatConversation({
                id: conversationId,
                accountId: auth.accountId,
                userId: auth.userId,
                gardenId: body.gardenId,
                raisedBedId: body.raisedBedId,
                model: model.id,
                title: 'Suncokret razgovor',
            });
            if (!conversation) {
                const error = jsonError(
                    'ai_conversation_forbidden',
                    'Razgovor ne pripada trenutnom računu.',
                    403,
                );
                return context.json(error.body, error.status);
            }

            const limitState = await getAiChatAccountLimitState(auth.accountId);
            if (limitState.blockedReason) {
                const error = jsonError(
                    'ai_daily_limit_exceeded',
                    limitState.blockedReason === 'disabled'
                        ? 'AI chat je onemogućen za ovaj račun.'
                        : 'Probni AI chat dani su iskorišteni. Nastavak je moguć nakon aktivacije gredice.',
                    429,
                    { retryAt: limitState.retryAt, limit: limitState },
                );
                return context.json(error.body, error.status);
            }

            const promptInput = {
                system: buildSuncokretSystemPrompt({
                    garden: gardenContext.garden
                        ? {
                              id: gardenContext.garden.id,
                              name: gardenContext.garden.name,
                          }
                        : null,
                    raisedBed: gardenContext.raisedBed
                        ? {
                              id: gardenContext.raisedBed.id,
                              name: gardenContext.raisedBed.name,
                              status: gardenContext.raisedBed.status,
                          }
                        : null,
                    positionIndex: body.positionIndex,
                    uiContext: body.uiContext,
                }),
                messages: body.messages.slice(-MAX_CONTEXT_MESSAGES),
            };
            const estimatedInputTokens =
                estimateSuncokretPromptTokens(promptInput);
            const maxOutputTokens = resolveSuncokretMaxOutputTokens({
                estimatedInputTokens,
                model,
                remainingMicroUsd: limitState.remainingMicroUsd,
            });

            if (maxOutputTokens < MIN_OUTPUT_TOKENS) {
                const error = jsonError(
                    'ai_daily_limit_exceeded',
                    'Dnevni limit za Suncokret chat je iskorišten. Možeš nastaviti sutra.',
                    429,
                    {
                        retryAt: aiChatRetryAtIso(
                            limitState.usageDate,
                            limitState.timeZone,
                        ),
                        limit: limitState,
                    },
                );
                return context.json(error.body, error.status);
            }

            const estimatedCostMicroUsd = estimateSuncokretRequestCostMicroUsd({
                inputTokens: estimatedInputTokens,
                maxOutputTokens,
                model,
            });
            const requestId = crypto.randomUUID();
            const reservation = await reserveAiChatUsage({
                accountId: auth.accountId,
                conversationId,
                estimatedCostMicroUsd,
                model: model.id,
                requestId,
                userId: auth.userId,
            });
            if (!reservation.ok) {
                const error = jsonError(
                    'ai_daily_limit_exceeded',
                    'Dnevni limit za Suncokret chat je iskorišten. Možeš nastaviti sutra.',
                    429,
                    {
                        retryAt: reservation.limitState.retryAt,
                        limit: reservation.limitState,
                    },
                );
                return context.json(error.body, error.status);
            }

            const token = await mcpToken(auth.userId, auth.accountId);
            const origin = new URL(context.req.url).origin;
            let finalized = false;
            let finishMetadata: Record<string, unknown> | null = null;

            try {
                const modelMessages = await convertToModelMessages(
                    body.messages as UIMessage[],
                );
                const result = streamText({
                    model: gateway(model.id),
                    system: promptInput.system,
                    messages: modelMessages,
                    tools: buildTools({
                        accountId: auth.accountId,
                        contextGardenId: body.gardenId,
                        contextRaisedBedId: body.raisedBedId,
                        origin,
                        token,
                        userId: auth.userId,
                    }),
                    stopWhen: stepCountIs(8),
                    prepareStep: ({ stepNumber }) => {
                        if (stepNumber < 4) {
                            return undefined;
                        }

                        return {
                            system: finalAnswerSystemPrompt(promptInput.system),
                            toolChoice: 'none',
                        };
                    },
                    maxOutputTokens,
                    providerOptions: {
                        gateway: {
                            user: `account:${auth.accountId}`,
                            tags: [
                                'feature:suncokret-chat',
                                `env:${process.env.VERCEL_ENV ?? 'local'}`,
                                `tier:${limitState.tier}`,
                                `conversation:${conversationId}`,
                            ],
                        },
                    },
                    onFinish: async ({ totalUsage }) => {
                        const usage = usageTokens(totalUsage);
                        const cost = await finalizeAiChatUsage({
                            ledgerId: reservation.ledgerId,
                            inputTokens: usage.inputTokens,
                            outputTokens: usage.outputTokens,
                            totalTokens: usage.totalTokens,
                            pricing: model,
                        });
                        finalized = true;
                        finishMetadata = {
                            suncokret: {
                                usage,
                                requestId,
                                ...(debugAllowed
                                    ? {
                                          model: model.id,
                                          cost,
                                          conversationId,
                                      }
                                    : {}),
                            },
                        };
                    },
                    onError: async ({ error }) => {
                        if (!finalized) {
                            await releaseAiChatUsageReservation({
                                ledgerId: reservation.ledgerId,
                                status: 'failed',
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : 'AI stream error',
                            });
                        }
                    },
                });

                return result.toUIMessageStreamResponse({
                    originalMessages: body.messages as UIMessage[],
                    consumeSseStream: consumeStream,
                    messageMetadata: ({ part }) => {
                        if (part.type !== 'finish') {
                            return undefined;
                        }

                        return (
                            finishMetadata ?? {
                                suncokret: {
                                    requestId,
                                    usage: usageTokens(part.totalUsage),
                                    ...(debugAllowed
                                        ? {
                                              model: model.id,
                                              conversationId,
                                              estimated: {
                                                  inputTokens:
                                                      estimatedInputTokens,
                                                  maxOutputTokens,
                                                  reservedMicroUsd:
                                                      estimatedCostMicroUsd,
                                              },
                                          }
                                        : {}),
                                },
                            }
                        );
                    },
                    onFinish: async ({ isAborted, messages }) => {
                        await replaceAiChatMessages({
                            conversationId,
                            messages,
                        });
                        if (isAborted && !finalized) {
                            await releaseAiChatUsageReservation({
                                ledgerId: reservation.ledgerId,
                            });
                        }
                    },
                });
            } catch (error) {
                if (!finalized) {
                    await releaseAiChatUsageReservation({
                        ledgerId: reservation.ledgerId,
                        status: 'failed',
                        error:
                            error instanceof Error
                                ? error.message
                                : 'AI route error',
                    });
                }

                console.error('Suncokret chat failed', error);
                const response = jsonError(
                    'ai_chat_failed',
                    'Suncokret trenutno ne može odgovoriti. Pokušaj ponovno kasnije.',
                    500,
                );
                return context.json(response.body, response.status);
            }
        },
    );

export default app;
