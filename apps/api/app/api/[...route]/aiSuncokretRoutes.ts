import {
    suncokretPlantDetailTabs,
    suncokretRaisedBedDetailTabs,
    suncokretSettingsSections,
    suncokretWeatherViews,
} from '@gredice/js/ai';
import {
    aiChatRetryAtIso,
    ensureAiChatConversation,
    finalizeAiChatUsage,
    getAiChatAccountLimitState,
    getAiChatConversationForUser,
    getAiChatConversationsForUser,
    getGarden,
    getRaisedBed,
    releaseAiChatUsageReservation,
    replaceAiChatMessages,
    reserveAiChatUsage,
    updateAiChatConversationTitle,
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
import {
    buildSuncokretFinalAnswerSystemPrompt,
    buildSuncokretSystemPrompt,
} from '../../../lib/ai/suncokretContext';
import {
    fallbackSuncokretConversationTitle,
    generateSuncokretConversationTitle,
} from '../../../lib/ai/suncokretConversationTitle';
import { visibleRaisedBedsForGarden } from '../../../lib/ai/suncokretGardenContext';
import {
    estimateSuncokretPromptTokens,
    estimateSuncokretRequestCostMicroUsd,
    getSuncokretModel,
    getSuncokretModelRegistry,
    resolveSuncokretMaxOutputTokens,
} from '../../../lib/ai/suncokretModels';
import { buildSuncokretUsageStatus } from '../../../lib/ai/suncokretUsage';
import { createJwt } from '../../../lib/auth/auth';
import { authSecurity } from '../../../lib/docs/security';
import {
    type AuthVariables,
    authValidator,
} from '../../../lib/hono/authValidator';

const MIN_OUTPUT_TOKENS = 128;
const MAX_CONTEXT_MESSAGES = 24;
const MAX_IMAGE_URLS_PER_ANALYSIS = 6;
const MAX_LEGACY_TITLE_BACKFILLS = 6;
const MAX_TOOL_STEPS = 6;

type ChatVariables = AuthVariables;

const FeatureFlagsSchema = z.object({
    enableSuncokretDebugFlag: z.boolean().optional().default(false),
});

const SuncokretUiContextSchema = z.discriminatedUnion('surface', [
    z.object({ surface: z.literal('garden') }),
    z.object({ surface: z.literal('raised-bed') }),
    z.object({
        surface: z.literal('raised-bed-details'),
        tab: z.enum(suncokretRaisedBedDetailTabs),
    }),
    z.object({
        surface: z.literal('plant-details'),
        tab: z.enum(suncokretPlantDetailTabs),
    }),
    z.object({
        surface: z.literal('weather'),
        view: z.enum(suncokretWeatherViews),
    }),
    z.object({
        surface: z.literal('settings'),
        section: z.enum(suncokretSettingsSections).optional().nullable(),
    }),
]);

const RecommendationDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const SuncokretRecommendationSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('operation'),
        operationId: z.number().int().positive(),
        gardenId: z.number().int().positive(),
        raisedBedId: z.number().int().positive(),
        positionIndex: z.number().int().min(0).optional(),
        scheduledDate: RecommendationDateSchema.optional(),
    }),
    z.object({
        kind: z.literal('sowing'),
        plantSortId: z.number().int().positive(),
        gardenId: z.number().int().positive(),
        raisedBedId: z.number().int().positive(),
        positionIndex: z.number().int().min(0),
        scheduledDate: RecommendationDateSchema.optional(),
    }),
]);

const ChatBodySchema = z.object({
    id: z.string().optional(),
    conversationId: z.string().optional(),
    messages: z.array(z.unknown()).min(1).max(80),
    gardenId: z.number().int().positive().optional().nullable(),
    raisedBedId: z.number().int().positive().optional().nullable(),
    positionIndex: z.number().int().min(0).optional().nullable(),
    modelId: z.string().trim().min(1).optional().nullable(),
    uiContext: SuncokretUiContextSchema.optional().nullable(),
    debug: z.boolean().optional(),
    featureFlags: FeatureFlagsSchema.optional().default({
        enableSuncokretDebugFlag: false,
    }),
});

const StatusQuerySchema = z.object({
    modelId: z.string().optional(),
    enableSuncokretDebugFlag: z.string().optional(),
});

const ConversationParamsSchema = z.object({
    conversationId: z.string().trim().min(1).max(128),
});

function conversationNeedsGeneratedTitle(title: string | null) {
    return !title || title === 'Suncokret razgovor';
}

function booleanFlag(value: string | undefined) {
    return ['1', 'true', 'yes', 'on'].includes(value?.toLowerCase() ?? '');
}

function queryFeatureFlags(query: z.infer<typeof StatusQuerySchema>) {
    return {
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

    if (
        raisedBed &&
        garden &&
        !visibleRaisedBedsForGarden(garden).some(
            (visibleRaisedBed) => visibleRaisedBed.id === raisedBed.id,
        )
    ) {
        return { allowed: false as const };
    }

    return {
        allowed: true as const,
        garden,
        raisedBed,
    };
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

async function callPublicJson(url: URL) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(
            `Public data request failed (${response.status.toString()})`,
        );
    }

    return (await response.json()) as unknown;
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
    contextFarmId,
    contextGardenId,
    contextRaisedBedId,
    origin,
    token,
    userId,
}: {
    accountId: string;
    contextFarmId?: number | null;
    contextGardenId?: number | null;
    contextRaisedBedId?: number | null;
    origin: string;
    token: string;
    userId: string;
}) {
    const mcp = (name: string, args: Record<string, unknown>) =>
        callMcpTool({ accountId, args, name, origin, token });

    const raisedBedDetailsTool = tool({
        description:
            'Dohvati detalje jedne gredice: polja, nazive biljaka i njihov životni ciklus.',
        inputSchema: z.object({
            gardenId: z.number().int().positive().optional(),
            raisedBedId: z.number().int().positive().optional(),
        }),
        execute: ({ gardenId, raisedBedId }) =>
            mcp('gardens/get-raised-bed-fields', {
                gardenId: gardenId ?? contextGardenId,
                raisedBedId: raisedBedId ?? contextRaisedBedId,
            }),
    });

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
        getRaisedBedFields: raisedBedDetailsTool,
        getRaisedBedDetails: raisedBedDetailsTool,
        getCurrentWeather: tool({
            description:
                'Dohvati aktualno vrijeme i aktivna vremenska upozorenja za farmu trenutnog vrta.',
            inputSchema: z.object({}),
            execute: () => {
                const url = new URL('/api/data/weather/now', origin);
                if (contextFarmId) {
                    url.searchParams.set('farmId', contextFarmId.toString());
                }
                return callPublicJson(url);
            },
        }),
        getWeatherForecast: tool({
            description:
                'Dohvati vremensku prognozu za planiranje radova u vrtu.',
            inputSchema: z.object({
                days: z.number().int().min(1).max(7).default(5),
            }),
            execute: async ({ days }) => {
                const forecast = await callPublicJson(
                    new URL('/api/data/weather', origin),
                );
                return Array.isArray(forecast)
                    ? { days: forecast.slice(0, days) }
                    : { days: [] };
            },
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
        presentRecommendations: tool({
            description:
                'Prikaži klikabilne prijedloge za konkretne radnje ili sijanja. Pozovi tek nakon provjere kataloga i ciljne gredice/polja. Za radnju koristi operationId iz kataloga radnji. Za sijanje koristi entityId sorte iz rezultata searchProducts kao plantSortId. Ako zadaješ datum, koristi YYYY-MM-DD. Ovaj alat samo prikazuje prijedloge; ne mijenja košaricu.',
            inputSchema: z.object({
                recommendations: z
                    .array(SuncokretRecommendationSchema)
                    .min(1)
                    .max(6),
            }),
            execute: (input) => input,
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
                enabled: true,
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
                },
                usage: buildSuncokretUsageStatus({
                    dailyLimit: limitState.dailyLimitMicroUsd,
                    dailyReserved: limitState.reservedMicroUsd,
                    dailyUsed: limitState.usedMicroUsd,
                    outputUsageUnitsPerToken:
                        model?.outputUsdPerMillionTokens ?? 0,
                    weeklyLimit: limitState.weeklyLimitMicroUsd,
                    weeklyReserved: limitState.weeklyReservedMicroUsd,
                    weeklyUsed: limitState.weeklyUsedMicroUsd,
                }),
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
    .get(
        '/conversations',
        describeRoute({
            description: 'List the current user Suncokret AI conversations',
            security: authSecurity,
        }),
        zValidator('query', StatusQuerySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const auth = context.get('authContext');
            const conversations = await getAiChatConversationsForUser({
                accountId: auth.accountId,
                userId: auth.userId,
            });
            const legacyTitleBackfillIds = new Set(
                conversations
                    .filter((conversation) =>
                        conversationNeedsGeneratedTitle(conversation.title),
                    )
                    .slice(0, MAX_LEGACY_TITLE_BACKFILLS)
                    .map((conversation) => conversation.id),
            );
            const titledConversations = await Promise.all(
                conversations.map(async (conversation) => {
                    if (!legacyTitleBackfillIds.has(conversation.id)) {
                        return conversation;
                    }

                    const model =
                        getSuncokretModel(conversation.model) ??
                        getSuncokretModel();
                    if (!model) {
                        return conversation;
                    }

                    let title: string | null = null;
                    try {
                        title = await generateSuncokretConversationTitle({
                            messages: conversation.messages,
                            modelId: model.id,
                        });
                    } catch (error) {
                        console.warn(
                            'Suncokret legacy conversation title generation failed',
                            { conversationId: conversation.id, error },
                        );
                        title = fallbackSuncokretConversationTitle(
                            conversation.messages,
                        );
                    }

                    if (!title) {
                        return conversation;
                    }

                    try {
                        await updateAiChatConversationTitle({
                            accountId: auth.accountId,
                            conversationId: conversation.id,
                            title,
                            userId: auth.userId,
                        });
                        return { ...conversation, title };
                    } catch (error) {
                        console.warn(
                            'Suncokret legacy conversation title persistence failed',
                            { conversationId: conversation.id, error },
                        );
                        return conversation;
                    }
                }),
            );

            return context.json({
                conversations: titledConversations.map((conversation) => ({
                    id: conversation.id,
                    title: conversation.title,
                    model: conversation.model,
                    gardenId: conversation.gardenId,
                    raisedBedId: conversation.raisedBedId,
                    createdAt: conversation.createdAt.toISOString(),
                    lastMessageAt: conversation.lastMessageAt?.toISOString(),
                })),
            });
        },
    )
    .get(
        '/conversations/:conversationId',
        describeRoute({
            description: 'Load a current user Suncokret AI conversation',
            security: authSecurity,
        }),
        zValidator('param', ConversationParamsSchema),
        zValidator('query', StatusQuerySchema),
        authValidator(['user', 'admin']),
        async (context) => {
            const auth = context.get('authContext');
            const { conversationId } = context.req.valid('param');
            const conversation = await getAiChatConversationForUser({
                accountId: auth.accountId,
                conversationId,
                userId: auth.userId,
            });
            if (!conversation) {
                const error = jsonError(
                    'ai_conversation_not_found',
                    'Razgovor nije pronađen.',
                    404,
                );
                return context.json(error.body, error.status);
            }

            return context.json({
                conversation: {
                    id: conversation.id,
                    title: conversation.title,
                    model: conversation.model,
                    gardenId: conversation.gardenId,
                    raisedBedId: conversation.raisedBedId,
                    createdAt: conversation.createdAt.toISOString(),
                    lastMessageAt: conversation.lastMessageAt?.toISOString(),
                    messages: conversation.messages.map((message) => ({
                        id: message.id,
                        role: message.role,
                        parts: message.parts,
                        metadata: message.metadata ?? undefined,
                    })),
                },
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
            const validatedGardenId = gardenContext.garden?.id ?? body.gardenId;
            const validatedRaisedBedId =
                gardenContext.raisedBed?.id ?? body.raisedBedId;
            const conversation = await ensureAiChatConversation({
                id: conversationId,
                accountId: auth.accountId,
                userId: auth.userId,
                gardenId: validatedGardenId,
                raisedBedId: validatedRaisedBedId,
                model: model.id,
                title: null,
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

            const generatedTitlePromise = conversationNeedsGeneratedTitle(
                conversation.title,
            )
                ? generateSuncokretConversationTitle({
                      messages: body.messages,
                      modelId: model.id,
                  }).catch((error) => {
                      console.warn(
                          'Suncokret conversation title generation failed',
                          { conversationId, error },
                      );
                      return fallbackSuncokretConversationTitle(body.messages);
                  })
                : null;
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
                        contextFarmId: gardenContext.garden?.farmId,
                        contextGardenId: validatedGardenId,
                        contextRaisedBedId: validatedRaisedBedId,
                        origin,
                        token,
                        userId: auth.userId,
                    }),
                    stopWhen: stepCountIs(8),
                    prepareStep: ({ stepNumber }) => {
                        if (stepNumber < MAX_TOOL_STEPS) {
                            return undefined;
                        }

                        return {
                            system: buildSuncokretFinalAnswerSystemPrompt(
                                promptInput.system,
                            ),
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
                            approvedByUserId: auth.userId,
                            conversationId,
                            messages,
                        });
                        if (generatedTitlePromise) {
                            const title = await generatedTitlePromise;
                            if (title) {
                                try {
                                    await updateAiChatConversationTitle({
                                        accountId: auth.accountId,
                                        conversationId,
                                        title,
                                        userId: auth.userId,
                                    });
                                } catch (error) {
                                    console.warn(
                                        'Suncokret conversation title persistence failed',
                                        { conversationId, error },
                                    );
                                }
                            }
                        }
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
