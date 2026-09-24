'use client';
import { useChat } from '@ai-sdk/react';
import { getBrowserGrediceAppOrigin } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
import { ChatMarker, ChatMessageScroller } from '@gredice/ui/Chat';
import { IconButton } from '@gredice/ui/IconButton';
import {
    Add,
    ArrowLeft,
    Close,
    History,
    LoaderSpinner,
    Send,
    Sun,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { sunflowerMascotArtwork } from '@gredice/ui/SunflowerVisuals';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { useQueryClient } from '@tanstack/react-query';
import {
    DefaultChatTransport,
    lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai';
import Image from 'next/image';
import {
    type FormEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useGameFlags } from '../GameFlagsContext';
import {
    photoAnalysisAttachment,
    restoreAnalysisAttachments,
} from './raisedBed/photoAnalysisChat';
import { SuncokretChatMessage } from './SuncokretChatMessage';
import type { SuncokretChatTarget } from './SuncokretChatProvider';
import {
    SuncokretConversationList,
    type SuncokretConversationSummary,
} from './SuncokretConversationList';
import { SuncokretMessageTimestamp } from './SuncokretMessageTimestamp';
import { SuncokretUsageButton } from './SuncokretUsageButton';
import {
    resolveSuncokretVisibleUsage,
    type SuncokretUsageStatus,
    suncokretContextSuggestions,
} from './suncokretChatContext';
import { invalidateSuncokretMutationQueries } from './suncokretChatQueryInvalidation';
import { groupSuncokretMessageTimestamps } from './suncokretChatTimestamps';
import {
    debugJson,
    formatRetryAt,
    messageTextContent,
    parseConversationDetailPayload,
    parseConversationListPayload,
    randomChatId,
    seedMessages,
    suncokretFlagParams,
} from './suncokretChatUtils';

type SuncokretLimit = {
    retryAt: string;
    blockedReason: string | null;
    trialChatDaysUsed: number;
    trialChatDaysLimit: number;
};

type SuncokretStatus = {
    enabled: boolean;
    debugEnabled?: boolean;
    model: { id: string; label: string } | null;
    limit: SuncokretLimit;
    usage: SuncokretUsageStatus;
};

type SuncokretModel = {
    id: string;
    label: string;
};

type ConversationContext = Pick<
    SuncokretChatTarget,
    'gardenId' | 'raisedBedId' | 'positionIndex' | 'uiContext'
>;

export function SuncokretChatPanel({
    open,
    target,
    onClose,
    conversationId,
    openRequest = 0,
    preparation,
    seedActions,
    renderPanel,
}: {
    open: boolean;
    target: SuncokretChatTarget;
    onClose?: () => void;
    conversationId?: string;
    openRequest?: number;
    preparation?: ReactNode;
    seedActions?: ReactNode;
    renderPanel?: (panel: ReactNode) => ReactNode;
}) {
    const queryClient = useQueryClient();
    const flags = useGameFlags();
    const debug = Boolean(flags.enableSuncokretDebugFlag);
    const [restored, setRestored] = useState(!conversationId);
    const [restoreError, setRestoreError] = useState(false);
    const [restoreAttempt, setRestoreAttempt] = useState(0);
    const [input, setInput] = useState('');
    const [statusInfo, setStatusInfo] = useState<SuncokretStatus | null>(null);
    const [models, setModels] = useState<SuncokretModel[]>([]);
    const [modelId, setModelId] = useState<string | null>(null);
    const [activeConversationId, setActiveConversationId] = useState(
        () => conversationId ?? randomChatId(),
    );
    const [activeConversationTitle, setActiveConversationTitle] = useState<
        string | null
    >(null);
    const [savedContext, setSavedContext] = useState<{
        sourceKey: string;
        context: ConversationContext;
    } | null>(null);
    const [chatView, setChatView] = useState<'chat' | 'conversations'>('chat');
    const [conversations, setConversations] = useState<
        SuncokretConversationSummary[]
    >([]);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [conversationsError, setConversationsError] = useState<string | null>(
        null,
    );
    const chatSessionId = useMemo(randomChatId, []);
    const apiOrigin = getBrowserGrediceAppOrigin('api');
    const featureFlags = useMemo(
        () => ({
            enableSuncokretDebugFlag: debug,
        }),
        [debug],
    );
    const featureFlagQuery = useMemo(
        () => suncokretFlagParams({ debug }),
        [debug],
    );
    const statusQuery = useMemo(() => {
        const params = new URLSearchParams(featureFlagQuery);
        if (debug && modelId) {
            params.set('modelId', modelId);
        }
        return params.toString();
    }, [debug, featureFlagQuery, modelId]);
    const { seed, conversationLabel } = target;
    const contextKey = JSON.stringify([
        target.gardenId,
        target.raisedBedId,
        target.positionIndex,
        target.uiContext,
        seed?.id,
    ]);
    const {
        gardenId,
        positionIndex,
        raisedBedId: contextRaisedBedId,
        uiContext,
    } = savedContext?.sourceKey === contextKey ? savedContext.context : target;
    const appliedSeedIdRef = useRef<string | null>(null);
    const requestContextRef = useRef({
        conversationId: activeConversationId,
        debug,
        featureFlags,
        gardenId,
        modelId,
        positionIndex,
        raisedBedId: contextRaisedBedId,
        uiContext,
    });
    const requestRaisedBedIdRef = useRef(contextRaisedBedId);
    requestContextRef.current = {
        conversationId: activeConversationId,
        debug,
        featureFlags,
        gardenId,
        modelId,
        positionIndex,
        raisedBedId: contextRaisedBedId,
        uiContext,
    };

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `${apiOrigin}/api/ai/suncokret/chat`,
                credentials: 'include',
                prepareSendMessagesRequest: ({ id, messages }) => {
                    const requestContext = requestContextRef.current;
                    requestRaisedBedIdRef.current = requestContext.raisedBedId;
                    return {
                        body: {
                            id,
                            conversationId: requestContext.conversationId,
                            messages,
                            gardenId: requestContext.gardenId,
                            raisedBedId: requestContext.raisedBedId,
                            positionIndex: requestContext.positionIndex,
                            modelId: requestContext.modelId,
                            uiContext: requestContext.uiContext,
                            debug: requestContext.debug,
                            featureFlags: requestContext.featureFlags,
                        },
                        credentials: 'include',
                    };
                },
            }),
        [apiOrigin],
    );

    const {
        addToolApprovalResponse,
        clearError,
        error,
        messages,
        sendMessage,
        setMessages,
        status,
        stop,
    } = useChat({
        id: chatSessionId,
        messages: seed ? seedMessages(seed) : [],
        transport,
        experimental_throttle: 80,
        onFinish: ({ message }) => {
            void invalidateSuncokretMutationQueries({
                fallbackRaisedBedId: requestRaisedBedIdRef.current,
                message,
                queryClient,
            });
        },
        sendAutomaticallyWhen:
            lastAssistantMessageIsCompleteWithApprovalResponses,
    });

    const [previousOpenRequest, setPreviousOpenRequest] = useState(openRequest);
    const openRequestRef = useRef(openRequest);
    openRequestRef.current = openRequest;
    if (previousOpenRequest !== openRequest) {
        setPreviousOpenRequest(openRequest);
        if (conversationId) {
            setChatView('chat');
            if (activeConversationId !== conversationId) {
                setActiveConversationId(conversationId);
                setActiveConversationTitle(seed?.title ?? null);
                setSavedContext(null);
                setInput('');
                setRestored(false);
            }
        }
    }

    const loading = status === 'submitted' || status === 'streaming';

    useEffect(() => {
        if (!open || status !== 'ready') {
            return;
        }

        let cancelled = false;
        void fetch(`${apiOrigin}/api/ai/suncokret/status?${statusQuery}`, {
            credentials: 'include',
        })
            .then((response) => response.json() as Promise<SuncokretStatus>)
            .then((nextStatus) => {
                if (cancelled) return;
                setStatusInfo(nextStatus);
                setModelId((current) =>
                    debug ? (current ?? nextStatus.model?.id ?? null) : null,
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setStatusInfo(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [apiOrigin, debug, open, status, statusQuery]);

    useEffect(() => {
        if (!debug) {
            setModels([]);
            setModelId(null);
            return;
        }
        if (!open) {
            return;
        }

        let cancelled = false;
        void fetch(`${apiOrigin}/api/ai/suncokret/models?${featureFlagQuery}`, {
            credentials: 'include',
        })
            .then(
                (response) =>
                    response.json() as Promise<{ models?: SuncokretModel[] }>,
            )
            .then((modelPayload) => {
                if (!cancelled) {
                    setModels(modelPayload.models ?? []);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setModels([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [apiOrigin, debug, featureFlagQuery, open]);

    useEffect(() => {
        if (
            conversationId ||
            !open ||
            !seed ||
            appliedSeedIdRef.current === seed.id
        ) {
            return;
        }

        appliedSeedIdRef.current = seed.id;
        setSavedContext(null);
        clearError();
        setInput('');
        setMessages(seedMessages(seed));
        setActiveConversationId(randomChatId());
        setActiveConversationTitle(seed.title ?? null);
        setChatView('chat');
    }, [clearError, conversationId, open, seed, setMessages]);

    // Restore before allowing any writes. Only a 404 means this review has no chat yet.
    // biome-ignore lint/correctness/useExhaustiveDependencies: retry explicitly reloads the saved conversation.
    useEffect(() => {
        if (!open || !conversationId || restored) return;
        const controller = new AbortController();
        setRestoreError(false);
        // An explicit review open can replace a conversation that is still streaming.
        void stop()
            .then(() =>
                fetch(
                    `${apiOrigin}/api/ai/suncokret/conversations/${encodeURIComponent(conversationId)}?${featureFlagQuery}`,
                    { credentials: 'include', signal: controller.signal },
                ),
            )
            .then(async (response) => {
                if (response.status === 404) return null;
                if (!response.ok)
                    throw new Error('Conversation request failed');
                const conversation = parseConversationDetailPayload(
                    await response.json(),
                );
                if (!conversation || conversation.id !== conversationId)
                    throw new Error('Invalid conversation response');
                return conversation;
            })
            .then((conversation) => {
                if (controller.signal.aborted) return;
                if (conversation) {
                    // A request blocked before its first message can leave an empty record.
                    setMessages(
                        conversation.messages.length
                            ? restoreAnalysisAttachments(
                                  conversation.messages,
                                  seed,
                              )
                            : seed
                              ? seedMessages(seed)
                              : [],
                    );
                    setActiveConversationTitle(conversation.title);
                } else {
                    setMessages(seed ? seedMessages(seed) : []);
                }
                clearError();
                setRestored(true);
            })
            .catch(() => {
                if (!controller.signal.aborted) setRestoreError(true);
            });
        return () => controller.abort();
    }, [
        apiOrigin,
        conversationId,
        featureFlagQuery,
        open,
        restored,
        restoreAttempt,
        setMessages,
    ]);

    const showConversationList = async () => {
        if (loading || preparation || !restored) {
            return;
        }

        setChatView('conversations');
        setConversationsLoading(true);
        setConversationsError(null);

        try {
            const response = await fetch(
                `${apiOrigin}/api/ai/suncokret/conversations?${featureFlagQuery}`,
                { credentials: 'include' },
            );
            if (!response.ok) {
                throw new Error('Conversation list request failed');
            }

            const payload: unknown = await response.json();
            const nextConversations = parseConversationListPayload(payload);
            if (!nextConversations) {
                throw new Error('Invalid conversation list response');
            }

            setConversations(nextConversations);
        } catch {
            setConversationsError(
                'Razgovori se trenutno ne mogu učitati. Pokušaj ponovno.',
            );
        } finally {
            setConversationsLoading(false);
        }
    };

    const selectConversation = async (conversationId: string) => {
        const requestedAt = openRequestRef.current;
        if (loading || preparation || !restored) {
            return;
        }

        setConversationsLoading(true);
        setConversationsError(null);

        try {
            const response = await fetch(
                `${apiOrigin}/api/ai/suncokret/conversations/${encodeURIComponent(conversationId)}?${featureFlagQuery}`,
                { credentials: 'include' },
            );
            if (!response.ok) {
                throw new Error('Conversation request failed');
            }

            const payload: unknown = await response.json();
            const conversation = parseConversationDetailPayload(payload);
            if (requestedAt !== openRequestRef.current) return;
            if (!conversation) {
                throw new Error('Invalid conversation response');
            }

            clearError();
            setInput('');
            setMessages(
                restoreAnalysisAttachments(conversation.messages, seed),
            );
            setActiveConversationId(conversation.id);
            setActiveConversationTitle(conversation.title);
            const photo = conversation.messages
                .map((message) => photoAnalysisAttachment(message.metadata))
                .find(Boolean);
            setSavedContext({
                sourceKey: contextKey,
                context: {
                    gardenId: conversation.gardenId,
                    raisedBedId: conversation.raisedBedId,
                    positionIndex: photo?.positionIndex ?? null,
                    uiContext:
                        photo?.positionIndex !== undefined
                            ? { surface: 'plant-details', tab: 'diary' }
                            : {
                                  surface: conversation.raisedBedId
                                      ? 'raised-bed'
                                      : 'garden',
                              },
                },
            });
            if (
                debug &&
                conversation.model &&
                models.some((model) => model.id === conversation.model)
            ) {
                setModelId(conversation.model);
            }
            setChatView('chat');
        } catch {
            setConversationsError(
                'Razgovor se trenutno ne može otvoriti. Pokušaj ponovno.',
            );
        } finally {
            setConversationsLoading(false);
        }
    };

    const startFreshConversation = () => {
        if (loading || preparation || !restored) {
            return;
        }

        clearError();
        setInput('');
        setMessages([]);
        setActiveConversationId(randomChatId());
        setActiveConversationTitle(null);
        setSavedContext(null);
        setChatView('chat');
    };

    const sendPrompt = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading || !restored || blocked || preparation) {
            return;
        }
        setInput('');
        void sendMessage({
            text: trimmed,
            metadata: { createdAt: new Date().toISOString() },
        });
    };

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        sendPrompt(input);
    };

    const limit = statusInfo?.limit;
    const streamingMessage =
        status === 'streaming' &&
        messages[messages.length - 1]?.role === 'assistant'
            ? messages[messages.length - 1]
            : undefined;
    const visibleUsage = resolveSuncokretVisibleUsage({
        streamingText: messageTextContent(streamingMessage),
        usage: statusInfo?.usage,
    });
    const dailyUsageExhausted = Boolean(
        visibleUsage && visibleUsage.day.remainingPercent <= 0,
    );
    const weeklyUsageExhausted = Boolean(
        visibleUsage && visibleUsage.week.remainingPercent <= 0,
    );
    const blocked = Boolean(
        limit?.blockedReason || dailyUsageExhausted || weeklyUsageExhausted,
    );
    const contextSuggestions =
        (messages.some((message) => message.id === `${seed?.id}-0`)
            ? seed?.suggestions
            : undefined) ?? suncokretContextSuggestions(uiContext);
    // A seeded thread already shows the analysis, so the empty-state prompts
    // are offered under it until the first question is asked.
    const showSeededSuggestions =
        chatView === 'chat' &&
        !loading &&
        !preparation &&
        restored &&
        messages.length > 0 &&
        messages.every((message) => message.role !== 'user');
    const isPhotoConversation =
        Boolean(preparation) ||
        messages.some((message) => photoAnalysisAttachment(message.metadata));
    const hasUserMessages = messages.some((message) => message.role === 'user');
    const suggestionButtons = contextSuggestions.map((suggestion, index) => (
        <Button
            key={suggestion.prompt}
            fullWidth
            size="sm"
            variant="outlined"
            className={cx(
                'rounded-full',
                index === 0 &&
                    'border-amber-200 bg-amber-50/60 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:hover:bg-amber-950',
            )}
            disabled={loading || blocked || !restored || Boolean(preparation)}
            onClick={() => sendPrompt(suggestion.prompt)}
        >
            {suggestion.label}
        </Button>
    ));

    const panel = (
        <div
            aria-label="Razgovor sa Suncokretom"
            className="flex h-[min(680px,calc(100dvh-var(--game-safe-area-top,0px)-var(--game-safe-area-bottom,0px)-1rem))] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-amber-200/80 border-b-4 border-b-amber-400 bg-background/98 shadow-2xl shadow-foreground/15 backdrop-blur-sm dark:border-amber-900/80 dark:border-b-amber-700 md:h-[min(720px,calc(100dvh-var(--game-safe-area-top,0px)-var(--game-safe-area-bottom,0px)-5rem))]"
            data-suncokret-chat
            role="dialog"
        >
            <Row
                justifyContent="space-between"
                className="border-b border-amber-200/70 bg-amber-50/80 px-3.5 py-3 dark:border-amber-900/70 dark:bg-amber-950/30"
            >
                <Row spacing={2} className="min-w-0">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border border-amber-200 bg-white shadow-sm dark:border-amber-900 dark:bg-amber-950">
                        <Image
                            src={sunflowerMascotArtwork}
                            alt=""
                            width={32}
                            height={32}
                            className="size-8"
                        />
                    </span>
                    <Stack spacing={0} className="min-w-0">
                        <Typography level="body2" semiBold noWrap>
                            {chatView === 'chat' && (
                                <span
                                    aria-hidden="true"
                                    className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500 align-middle"
                                />
                            )}
                            Suncokret
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                            noWrap
                        >
                            {chatView === 'conversations'
                                ? 'Prijašnji razgovori'
                                : (activeConversationTitle ??
                                  `Razgovor za ${conversationLabel}`)}
                        </Typography>
                    </Stack>
                </Row>
                <Row spacing={1}>
                    {chatView === 'conversations' ? (
                        <IconButton
                            title="Natrag na razgovor"
                            variant="plain"
                            disabled={conversationsLoading}
                            onClick={() => setChatView('chat')}
                        >
                            <ArrowLeft className="size-4" />
                        </IconButton>
                    ) : (
                        <IconButton
                            title="Prijašnji razgovori"
                            variant="plain"
                            disabled={
                                loading || Boolean(preparation) || !restored
                            }
                            onClick={() => {
                                void showConversationList();
                            }}
                        >
                            <History className="size-4" />
                        </IconButton>
                    )}
                    <IconButton
                        title="Novi razgovor"
                        variant="plain"
                        disabled={loading || Boolean(preparation) || !restored}
                        onClick={startFreshConversation}
                    >
                        <Add className="size-4" />
                    </IconButton>
                    {chatView === 'chat' && debug && models.length > 1 && (
                        <select
                            aria-label="AI model"
                            data-suncokret-model-picker
                            value={modelId ?? ''}
                            onChange={(event) =>
                                setModelId(event.target.value || null)
                            }
                            className="h-8 max-w-32 rounded-full border bg-background px-2.5 text-xs"
                        >
                            {models.map((model) => (
                                <option key={model.id} value={model.id}>
                                    {model.label}
                                </option>
                            ))}
                        </select>
                    )}
                    {onClose && (
                        <IconButton
                            title="Zatvori"
                            variant="plain"
                            onClick={onClose}
                        >
                            <Close className="size-4" />
                        </IconButton>
                    )}
                </Row>
            </Row>

            {chatView === 'conversations' ? (
                <SuncokretConversationList
                    conversations={conversations}
                    currentConversationId={activeConversationId}
                    error={conversationsError}
                    loading={conversationsLoading}
                    onSelect={(conversationId) => {
                        void selectConversation(conversationId);
                    }}
                />
            ) : (
                <>
                    <ChatMessageScroller
                        ariaBusy={loading}
                        ariaLabel="Poruke sa Suncokretom"
                        autoScroll={!isPhotoConversation || hasUserMessages}
                        className="flex-1"
                        defaultScrollPosition={
                            isPhotoConversation
                                ? hasUserMessages
                                    ? 'last-anchor'
                                    : 'start'
                                : 'end'
                        }
                        emptyContent={
                            <Stack
                                alignItems="center"
                                spacing={4}
                                className="w-full px-3 text-center"
                            >
                                <span className="grid size-14 place-items-center rounded-full border border-amber-200 bg-amber-50 shadow-sm dark:border-amber-900 dark:bg-amber-950">
                                    <Sun className="size-7 text-amber-500" />
                                </span>
                                <Stack spacing={1} alignItems="center">
                                    <Typography level="h6" semiBold>
                                        Kako ti mogu pomoći?
                                    </Typography>
                                    <Typography
                                        level="body3"
                                        className="max-w-72 text-muted-foreground"
                                    >
                                        Pitaj me o stanju vrta, sadnji ili
                                        radnjama koje slijede.
                                    </Typography>
                                </Stack>
                                <Stack spacing={2} className="w-full">
                                    {suggestionButtons}
                                </Stack>
                            </Stack>
                        }
                        items={[
                            ...(preparation
                                ? [
                                      {
                                          id: 'suncokret-preparation',
                                          scrollAnchor: true,
                                          content: preparation,
                                      },
                                  ]
                                : []),
                            ...groupSuncokretMessageTimestamps(
                                messages,
                                seed,
                            ).map(({ message, timestamp }) => ({
                                id: message.id,
                                scrollAnchor:
                                    message.role === 'user' ||
                                    Boolean(
                                        photoAnalysisAttachment(
                                            message.metadata,
                                        ),
                                    ),
                                content: (
                                    <>
                                        {timestamp && (
                                            <SuncokretMessageTimestamp
                                                timestamp={timestamp}
                                            />
                                        )}
                                        <SuncokretChatMessage
                                            addToolApprovalResponse={
                                                addToolApprovalResponse
                                            }
                                            debug={debug}
                                            isStreaming={
                                                loading &&
                                                message.role === 'assistant' &&
                                                message.id ===
                                                    messages[
                                                        messages.length - 1
                                                    ]?.id
                                            }
                                            message={message}
                                            actions={
                                                message.id ===
                                                    `${seed?.id}-0` &&
                                                activeConversationId ===
                                                    conversationId
                                                    ? seedActions
                                                    : undefined
                                            }
                                        />
                                    </>
                                ),
                            })),
                            ...(showSeededSuggestions
                                ? [
                                      {
                                          id: 'suncokret-seed-suggestions',
                                          content: (
                                              <Stack
                                                  spacing={2}
                                                  className="w-full px-3"
                                              >
                                                  <Typography
                                                      level="body3"
                                                      className="text-muted-foreground"
                                                  >
                                                      Nastavi razgovor jednim od
                                                      prijedloga ili pitaj svoje
                                                      pitanje.
                                                  </Typography>
                                                  {suggestionButtons}
                                              </Stack>
                                          ),
                                      },
                                  ]
                                : []),
                            ...(loading
                                ? [
                                      {
                                          id: 'suncokret-loading',
                                          content: (
                                              <ChatMarker
                                                  className="px-10"
                                                  icon={
                                                      <LoaderSpinner className="animate-spin" />
                                                  }
                                                  role="status"
                                              >
                                                  <span className="chat-shimmer">
                                                      Suncokret razmišlja...
                                                  </span>
                                              </ChatMarker>
                                          ),
                                      },
                                  ]
                                : []),
                        ]}
                    />

                    <Stack
                        spacing={2}
                        className="border-t bg-background/95 p-3"
                    >
                        {!restored &&
                            (restoreError ? (
                                <div
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    Razgovor se trenutno ne može učitati.
                                    <Button
                                        size="sm"
                                        variant="plain"
                                        onClick={() =>
                                            setRestoreAttempt(
                                                (attempt) => attempt + 1,
                                            )
                                        }
                                    >
                                        Pokušaj ponovno
                                    </Button>
                                </div>
                            ) : (
                                <Typography level="body3" role="status">
                                    Učitavanje razgovora...
                                </Typography>
                            ))}
                        {blocked && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                {weeklyUsageExhausted
                                    ? 'Tjedni limit je iskorišten.'
                                    : 'Limit za zadnja 24 sata je iskorišten.'}{' '}
                                Nastavak je moguć{' '}
                                {formatRetryAt(limit?.retryAt)}.
                            </div>
                        )}
                        {error && (
                            <div className="rounded-xl border border-red-300 bg-red-50 p-2.5 text-xs text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                                {error.message}
                            </div>
                        )}
                        <form
                            onSubmit={onSubmit}
                            className="overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring"
                        >
                            <textarea
                                aria-label="Pitaj Suncokret"
                                value={input}
                                disabled={
                                    loading ||
                                    blocked ||
                                    !restored ||
                                    Boolean(preparation)
                                }
                                onChange={(event) =>
                                    setInput(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (
                                        event.key === 'Enter' &&
                                        !event.shiftKey
                                    ) {
                                        event.preventDefault();
                                        sendPrompt(input);
                                    }
                                }}
                                className="min-h-14 max-h-28 w-full resize-none border-0 bg-transparent px-4 py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed"
                                placeholder="Pitaj Suncokret..."
                            />
                            <Row
                                justifyContent="space-between"
                                className="border-t border-border/60 px-2 py-2"
                            >
                                <span
                                    aria-live="polite"
                                    className="px-1 text-xs text-muted-foreground"
                                >
                                    Enter šalje poruku
                                </span>
                                <Row spacing={1}>
                                    {visibleUsage && (
                                        <SuncokretUsageButton
                                            day={visibleUsage.day}
                                            week={visibleUsage.week}
                                        />
                                    )}
                                    <IconButton
                                        title={
                                            loading
                                                ? 'Suncokret odgovara'
                                                : 'Pošalji'
                                        }
                                        type="submit"
                                        disabled={
                                            loading ||
                                            blocked ||
                                            !restored ||
                                            Boolean(preparation) ||
                                            input.trim().length === 0
                                        }
                                        className="size-9 shrink-0 rounded-full bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                    >
                                        {loading ? (
                                            <LoaderSpinner className="size-4 animate-spin" />
                                        ) : (
                                            <Send className="size-4" />
                                        )}
                                    </IconButton>
                                </Row>
                            </Row>
                        </form>
                        {debug && statusInfo && (
                            <details className="text-xs text-muted-foreground">
                                <summary className="cursor-pointer">
                                    Debug
                                </summary>
                                <pre className="mt-1 max-h-36 overflow-auto rounded-sm bg-muted p-2">
                                    {debugJson(statusInfo)}
                                </pre>
                            </details>
                        )}
                    </Stack>
                </>
            )}
        </div>
    );
    return renderPanel ? renderPanel(panel) : panel;
}
