'use client';

import { useChat } from '@ai-sdk/react';
import { getBrowserGrediceAppOrigin } from '@gredice/client';
import { sanitizeSuncokretAssistantText } from '@gredice/js/ai';
import { Button } from '@gredice/ui/Button';
import {
    ChatBubble,
    ChatMarker,
    ChatMessage as ChatMessageLayout,
    ChatMessageResponse,
    ChatMessageScroller,
} from '@gredice/ui/Chat';
import { IconButton } from '@gredice/ui/IconButton';
import {
    AI,
    Check,
    Close,
    LoaderSpinner,
    Send,
    Sun,
    Warning,
} from '@gredice/ui/icons';
import { Popper } from '@gredice/ui/Popper';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import {
    DefaultChatTransport,
    lastAssistantMessageIsCompleteWithApprovalResponses,
    type UIMessage,
} from 'ai';
import Image from 'next/image';
import {
    type FormEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { useGameFlags } from '../GameFlagsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGameState } from '../useGameState';
import { useOverviewSectionParam } from '../useUrlState';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';
import { HudCard } from './components/HudCard';
import { useSuncokretChat } from './SuncokretChatProvider';
import { SuncokretChatTrigger } from './SuncokretChatTrigger';
import {
    formatSuncokretUsagePercent,
    resolveSuncokretUiContext,
    resolveSuncokretVisibleUsage,
    type SuncokretUsagePeriod,
    type SuncokretUsageStatus,
    suncokretContextSuggestions,
    suncokretConversationLabel,
} from './suncokretChatContext';

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

const desktopChatQuery = '(min-width: 768px)';

function subscribeToDesktopChatLayout(onChange: () => void) {
    const mediaQuery = window.matchMedia(desktopChatQuery);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
}

function desktopChatLayoutSnapshot() {
    return window.matchMedia(desktopChatQuery).matches;
}

function SuncokretChatPositioner({
    anchorElement,
    children,
    isCloseup,
    onClose,
}: {
    anchorElement: HTMLElement | null;
    children: ReactNode;
    isCloseup: boolean;
    onClose: () => void;
}) {
    const desktop = useSyncExternalStore(
        subscribeToDesktopChatLayout,
        desktopChatLayoutSnapshot,
        () => false,
    );
    const virtualRef = useMemo(
        () => (anchorElement ? { current: anchorElement } : undefined),
        [anchorElement],
    );

    if (desktop && anchorElement && virtualRef) {
        const anchorRect = anchorElement.getBoundingClientRect();
        const anchorCenter = anchorRect.left + anchorRect.width / 2;
        const side = anchorCenter < window.innerWidth / 2 ? 'right' : 'left';

        return (
            <Popper
                align="center"
                className="!w-[440px] max-w-[calc(100vw-var(--game-safe-area-left,0px)-var(--game-safe-area-right,0px)-1rem)] border-0 bg-transparent p-0 shadow-none"
                data-suncokret-placement="anchored"
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        onClose();
                    }
                }}
                open
                side={side}
                sideOffset={12}
                virtualRef={virtualRef}
            >
                {children}
            </Popper>
        );
    }

    return (
        <div
            className={cx(
                'pointer-events-auto fixed bottom-[calc(var(--game-safe-area-bottom,0px)+0.5rem)] left-[calc(var(--game-safe-area-left,0px)+0.5rem)] right-[calc(var(--game-safe-area-right,0px)+0.5rem)] z-50 flex justify-center md:block',
                isCloseup
                    ? 'md:right-auto md:left-[calc(var(--game-safe-area-left,0px)+0.5rem)]'
                    : 'md:right-[calc(var(--game-safe-area-right,0px)+0.5rem)] md:left-auto',
            )}
            data-suncokret-placement={
                isCloseup ? 'bottom-left' : 'bottom-right'
            }
        >
            {children}
        </div>
    );
}

function UsagePeriodIndicator({
    label,
    period,
}: {
    label: string;
    period: SuncokretUsagePeriod;
}) {
    const used = formatSuncokretUsagePercent(period.usedPercent);
    const remaining = formatSuncokretUsagePercent(period.remainingPercent);

    return (
        <div className="min-w-0 flex-1">
            <Row justifyContent="space-between" className="gap-2 text-[11px]">
                <span className="font-medium text-foreground">{label}</span>
                <span className="truncate text-muted-foreground">
                    {used} iskorišteno · {remaining} preostalo
                </span>
            </Row>
            <div
                aria-label={`${label}: ${used} iskorišteno, ${remaining} preostalo`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={Math.round(period.usedPercent)}
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
            >
                <div
                    className="h-full rounded-full bg-amber-400 transition-[width] duration-300 dark:bg-amber-500"
                    style={{ width: `${period.usedPercent}%` }}
                />
            </div>
        </div>
    );
}

function randomChatId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `suncokret-${Date.now().toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function textPart(part: unknown) {
    if (!isRecord(part) || part.type !== 'text') {
        return null;
    }

    return typeof part.text === 'string' ? part.text : null;
}

function toolPart(part: unknown) {
    if (!isRecord(part)) {
        return null;
    }

    const type = typeof part.type === 'string' ? part.type : '';
    return type.startsWith('tool-') ? part : null;
}

function messagePartKey(part: unknown) {
    if (!isRecord(part)) {
        return 'part:unknown';
    }

    const type = typeof part.type === 'string' ? part.type : 'part';
    const id = typeof part.id === 'string' ? part.id : null;
    const toolCallId =
        typeof part.toolCallId === 'string' ? part.toolCallId : null;
    const text = typeof part.text === 'string' ? part.text.slice(0, 80) : null;

    return `${type}:${id ?? toolCallId ?? text ?? debugJson(part).slice(0, 80)}`;
}

function toolName(part: Record<string, unknown>) {
    const type = typeof part.type === 'string' ? part.type : '';
    return type.replace(/^tool-/, '');
}

function toolActivityLabel(name: string) {
    switch (name) {
        case 'listGardens':
            return 'Provjeravam vrtove';
        case 'listRaisedBeds':
            return 'Provjeravam gredice';
        case 'getRaisedBedFields':
        case 'getRaisedBedDetails':
            return 'Provjeravam polja u gredici';
        case 'getCurrentWeather':
            return 'Provjeravam aktualno vrijeme';
        case 'getWeatherForecast':
            return 'Provjeravam vremensku prognozu';
        case 'listGardenOperations':
            return 'Provjeravam radnje';
        case 'getRaisedBedAiHistory':
            return 'Provjeravam ranije savjete';
        case 'searchDirectory':
        case 'getOperationsDirectory':
            return 'Pretražujem Gredice katalog';
        case 'searchProducts':
            return 'Provjeravam ponudu';
        case 'getCart':
            return 'Provjeravam košaricu';
        case 'addProductToCart':
        case 'updateCartItem':
            return 'Pripremam košaricu';
        case 'analyzeRaisedBedImages':
            return 'Analiziram fotografije';
        case 'prepareCheckout':
            return 'Pripremam checkout';
        default:
            return 'Provjeravam podatke';
    }
}

function approval(part: Record<string, unknown>) {
    return isRecord(part.approval) ? part.approval : null;
}

function approvalId(part: Record<string, unknown>) {
    const approvalData = approval(part);
    return typeof approvalData?.id === 'string' ? approvalData.id : null;
}

function toolState(part: Record<string, unknown>) {
    const approvalData = approval(part);
    if (typeof approvalData?.state === 'string') {
        return approvalData.state;
    }
    return typeof part.state === 'string' ? part.state : 'unknown';
}

function isToolApprovalRequested(part: Record<string, unknown>) {
    return (
        toolState(part) === 'approval-requested' && Boolean(approvalId(part))
    );
}

function isToolCompleteState(state: string) {
    return (
        state === 'output-available' ||
        state === 'result' ||
        state === 'approval-responded' ||
        state === 'output-denied'
    );
}

function isToolErrorState(state: string) {
    return state === 'output-error' || state === 'error';
}

function isToolDeniedState(state: string) {
    return state === 'output-denied';
}

function isToolApprovalRespondedState(state: string) {
    return state === 'approval-responded';
}

function isToolRunningState(state: string) {
    return (
        !isToolCompleteState(state) &&
        !isToolErrorState(state) &&
        state !== 'approval-requested'
    );
}

function debugJson(value: unknown) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function formatRetryAt(value: string | null | undefined) {
    if (!value) return 'sutra';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'sutra';
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function messageTextContent(message: UIMessage | undefined) {
    if (!message) {
        return '';
    }

    return message.parts
        .map((part) => textPart(part) ?? '')
        .join('')
        .trim();
}

function suncokretFlagParams({
    debug,
    enabled,
}: {
    debug: boolean;
    enabled: boolean;
}) {
    const params = new URLSearchParams({
        enableSuncokretChatFlag: enabled ? 'true' : 'false',
        enableSuncokretDebugFlag: debug ? 'true' : 'false',
    });
    return params.toString();
}

function MessageText({
    children,
    isStreaming,
}: {
    children: string;
    isStreaming: boolean;
}) {
    const safeText = sanitizeSuncokretAssistantText(children);

    return (
        <ChatMessageResponse
            className="text-sm leading-relaxed"
            isAnimating={isStreaming}
        >
            {safeText}
        </ChatMessageResponse>
    );
}

function ToolPart({
    addToolApprovalResponse,
    debug,
    part,
}: {
    addToolApprovalResponse: ReturnType<
        typeof useChat
    >['addToolApprovalResponse'];
    debug: boolean;
    part: Record<string, unknown>;
}) {
    const state = toolState(part);
    const requestedApproval = isToolApprovalRequested(part);
    const id = approvalId(part);
    const name = toolName(part);

    return (
        <div className="rounded-xl border bg-muted/30 p-3 text-xs">
            <Row justifyContent="space-between" className="gap-2">
                <Stack spacing={0} className="min-w-0">
                    <Typography level="body3" semiBold>
                        {requestedApproval
                            ? 'Suncokret treba potvrdu'
                            : toolActivityLabel(name)}
                    </Typography>
                    {requestedApproval && (
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Prije promjene u vrtu ili košarici potvrdi nastavak.
                        </Typography>
                    )}
                </Stack>
                {debug && (
                    <span className="rounded-sm bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-normal text-muted-foreground">
                        {name} · {state}
                    </span>
                )}
            </Row>
            {requestedApproval && id && (
                <Row spacing={1} className="mt-2">
                    <Button
                        size="xs"
                        color="success"
                        startDecorator={<Check className="size-3" />}
                        onClick={() =>
                            addToolApprovalResponse({
                                id,
                                approved: true,
                            })
                        }
                    >
                        Dopusti
                    </Button>
                    <Button
                        size="xs"
                        variant="outlined"
                        color="danger"
                        startDecorator={<Close className="size-3" />}
                        onClick={() =>
                            addToolApprovalResponse({
                                id,
                                approved: false,
                            })
                        }
                    >
                        Odustani
                    </Button>
                </Row>
            )}
            {debug && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground">
                        Detalji alata
                    </summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded-sm bg-background p-2 text-[11px]">
                        {debugJson(part)}
                    </pre>
                </details>
            )}
        </div>
    );
}

function formatActivityScopes(scopes: string[]) {
    if (scopes.length === 0) {
        return 'podatke';
    }

    if (scopes.length === 1) {
        return scopes[0];
    }

    if (scopes.length === 2) {
        return `${scopes[0]} i ${scopes[1]}`;
    }

    return `${scopes.slice(0, -1).join(', ')} i ${scopes[scopes.length - 1]}`;
}

function toolActivityScope(parts: Record<string, unknown>[]) {
    const names = parts.map(toolName);
    const scopes = [
        names.some((name) => name === 'analyzeRaisedBedImages')
            ? 'fotografije'
            : null,
        names.some((name) =>
            [
                'listGardens',
                'listRaisedBeds',
                'getRaisedBedFields',
                'getRaisedBedDetails',
                'listGardenOperations',
                'getRaisedBedAiHistory',
            ].includes(name),
        )
            ? 'vrt'
            : null,
        names.some((name) =>
            ['getCurrentWeather', 'getWeatherForecast'].includes(name),
        )
            ? 'vrijeme'
            : null,
        names.some((name) =>
            [
                'searchDirectory',
                'getOperationsDirectory',
                'searchProducts',
            ].includes(name),
        )
            ? 'katalog'
            : null,
        names.some((name) =>
            [
                'getCart',
                'addProductToCart',
                'updateCartItem',
                'prepareCheckout',
            ].includes(name),
        )
            ? 'košaricu'
            : null,
    ].filter((scope) => typeof scope === 'string');

    return formatActivityScopes(scopes);
}

function toolActivitySummary({
    isStreaming,
    parts,
}: {
    isStreaming: boolean;
    parts: Record<string, unknown>[];
}) {
    const errorPart = parts.find((part) => isToolErrorState(toolState(part)));
    if (errorPart) {
        return 'Dio podataka nije dostupan. Suncokret nastavlja s onim što ima.';
    }

    const deniedPart = parts.find((part) => isToolDeniedState(toolState(part)));
    if (deniedPart) {
        return 'Radnja je otkazana.';
    }

    const approvalRespondedPart = parts.find((part) =>
        isToolApprovalRespondedState(toolState(part)),
    );
    if (approvalRespondedPart) {
        return 'Potvrda je zabilježena.';
    }

    const runningPart = parts.find((part) =>
        isToolRunningState(toolState(part)),
    );
    if (runningPart) {
        return `${toolActivityLabel(toolName(runningPart))}...`;
    }

    if (isStreaming) {
        return 'Suncokret slaže odgovor...';
    }

    return `Suncokret je provjerio ${toolActivityScope(parts)}.`;
}

function ChatMessage({
    addToolApprovalResponse,
    debug,
    isStreaming,
    message,
}: {
    addToolApprovalResponse: ReturnType<
        typeof useChat
    >['addToolApprovalResponse'];
    debug: boolean;
    isStreaming: boolean;
    message: UIMessage;
}) {
    const isUser = message.role === 'user';
    const partKeyCounts = new Map<string, number>();
    const toolParts = message.parts
        .map(toolPart)
        .filter((part): part is Record<string, unknown> => Boolean(part));
    const hasText = message.parts.some((part) => Boolean(textPart(part)));
    const passiveToolParts = toolParts.filter(
        (part) => !isToolApprovalRequested(part),
    );
    const showToolActivity =
        !debug &&
        passiveToolParts.length > 0 &&
        (!hasText ||
            isStreaming ||
            passiveToolParts.some((part) => {
                const state = toolState(part);
                return isToolRunningState(state) || isToolErrorState(state);
            }));
    const hasToolError = passiveToolParts.some((part) =>
        isToolErrorState(toolState(part)),
    );
    const hasRunningTool = passiveToolParts.some((part) =>
        isToolRunningState(toolState(part)),
    );
    const hasDeniedTool = passiveToolParts.some((part) =>
        isToolDeniedState(toolState(part)),
    );
    const hasApprovalRespondedTool = passiveToolParts.some((part) =>
        isToolApprovalRespondedState(toolState(part)),
    );

    return (
        <ChatMessageLayout
            align={isUser ? 'end' : 'start'}
            avatar={
                isUser ? undefined : (
                    <Image
                        src="https://cdn.gredice.com/sunflower-large.svg"
                        alt=""
                        width={32}
                        height={32}
                        className="size-full bg-amber-50 p-1 dark:bg-amber-950"
                    />
                )
            }
            header={isUser ? undefined : 'Suncokret'}
        >
            <ChatBubble
                align={isUser ? 'end' : 'start'}
                className={cx('flex flex-col gap-2', !isUser && 'w-full')}
                variant={isUser ? 'sunflower' : 'ghost'}
            >
                {message.parts.map((part) => {
                    const baseKey = messagePartKey(part);
                    const duplicateCount = partKeyCounts.get(baseKey) ?? 0;
                    partKeyCounts.set(baseKey, duplicateCount + 1);
                    const key =
                        duplicateCount === 0
                            ? baseKey
                            : `${baseKey}:${duplicateCount}`;
                    const text = textPart(part);
                    if (text) {
                        return (
                            <MessageText key={key} isStreaming={isStreaming}>
                                {text}
                            </MessageText>
                        );
                    }

                    const toolData = toolPart(part);
                    if (toolData) {
                        if (!debug && !isToolApprovalRequested(toolData)) {
                            return null;
                        }

                        return (
                            <ToolPart
                                key={key}
                                addToolApprovalResponse={
                                    addToolApprovalResponse
                                }
                                debug={debug}
                                part={toolData}
                            />
                        );
                    }

                    return debug ? (
                        <pre
                            key={key}
                            className="max-h-40 overflow-auto rounded-sm bg-muted p-2 text-[11px]"
                        >
                            {debugJson(part)}
                        </pre>
                    ) : null;
                })}
                {showToolActivity && (
                    <ChatMarker
                        className={cx(
                            'w-fit rounded-full bg-muted/60 px-2.5 py-1',
                            hasToolError
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100'
                                : 'text-muted-foreground',
                        )}
                        icon={
                            hasToolError ? (
                                <Warning />
                            ) : hasDeniedTool ? (
                                <Close />
                            ) : hasRunningTool ||
                              (isStreaming && !hasApprovalRespondedTool) ? (
                                <LoaderSpinner className="animate-spin" />
                            ) : (
                                <AI />
                            )
                        }
                        role="status"
                    >
                        {toolActivitySummary({
                            isStreaming,
                            parts: passiveToolParts,
                        })}
                    </ChatMarker>
                )}
                {debug && Boolean(message.metadata) && (
                    <details>
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                            Metadata
                        </summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded-sm bg-muted p-2 text-[11px]">
                            {debugJson(message.metadata)}
                        </pre>
                    </details>
                )}
            </ChatBubble>
        </ChatMessageLayout>
    );
}

export function SuncokretChatHud() {
    const flags = useGameFlags();
    const enabled = Boolean(flags.enableSuncokretChatFlag);
    const debug = Boolean(flags.enableSuncokretDebugFlag);
    const chat = useSuncokretChat();
    const open = chat?.open ?? false;
    const [input, setInput] = useState('');
    const [statusInfo, setStatusInfo] = useState<SuncokretStatus | null>(null);
    const [models, setModels] = useState<SuncokretModel[]>([]);
    const [modelId, setModelId] = useState<string | null>(null);
    const chatId = useMemo(randomChatId, []);
    const apiOrigin = getBrowserGrediceAppOrigin('api');
    const featureFlags = useMemo(
        () => ({
            enableSuncokretChatFlag: enabled,
            enableSuncokretDebugFlag: debug,
        }),
        [debug, enabled],
    );
    const featureFlagQuery = useMemo(
        () => suncokretFlagParams({ debug, enabled }),
        [debug, enabled],
    );
    const { data: currentGarden } = useCurrentGarden();
    const [settingsSection] = useOverviewSectionParam();
    const view = useGameState((state) => state.view);
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const raisedBed = closeupBlock
        ? findRaisedBedByBlockId(currentGarden, closeupBlock.id)
        : null;
    const defaultGardenId = currentGarden?.id ?? null;
    const defaultRaisedBedId = raisedBed?.id ?? null;
    const defaultUiContext = useMemo(
        () =>
            resolveSuncokretUiContext({
                raisedBedName: raisedBed?.name,
                settingsSection,
            }),
        [raisedBed?.name, settingsSection],
    );
    const uiContext = chat?.target?.uiContext ?? defaultUiContext;
    const gardenId = chat?.target ? chat.target.gardenId : defaultGardenId;
    const contextRaisedBedId = chat?.target
        ? chat.target.raisedBedId
        : defaultUiContext.surface === 'raised-bed'
          ? defaultRaisedBedId
          : null;
    const positionIndex = chat?.target?.positionIndex ?? null;
    const conversationLabel =
        chat?.target?.conversationLabel ??
        suncokretConversationLabel({
            gardenName: currentGarden?.name,
            raisedBedName: raisedBed?.name,
            settingsSection,
        });
    const requestContextRef = useRef({
        debug,
        featureFlags,
        gardenId,
        modelId,
        positionIndex,
        raisedBedId: contextRaisedBedId,
        uiContext,
    });
    requestContextRef.current = {
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
                    return {
                        body: {
                            id,
                            conversationId: id,
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

    const { addToolApprovalResponse, error, messages, sendMessage, status } =
        useChat({
            id: chatId,
            transport,
            experimental_throttle: 80,
            sendAutomaticallyWhen:
                lastAssistantMessageIsCompleteWithApprovalResponses,
        });

    const loading = status === 'submitted' || status === 'streaming';

    useEffect(() => {
        if (!enabled || !open || status !== 'ready') {
            return;
        }

        let cancelled = false;
        void fetch(`${apiOrigin}/api/ai/suncokret/status?${featureFlagQuery}`, {
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
    }, [apiOrigin, debug, enabled, featureFlagQuery, open, status]);

    useEffect(() => {
        if (!debug) {
            setModels([]);
            setModelId(null);
            return;
        }
        if (!enabled || !open) {
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
    }, [apiOrigin, debug, enabled, featureFlagQuery, open]);

    if (!enabled || !chat) {
        return null;
    }

    const sendPrompt = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) {
            return;
        }
        setInput('');
        void sendMessage({ text: trimmed });
    };

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        sendPrompt(input);
    };

    const limit = statusInfo?.limit;
    const blocked = Boolean(limit?.blockedReason);
    const streamingMessage =
        status === 'streaming' &&
        messages[messages.length - 1]?.role === 'assistant'
            ? messages[messages.length - 1]
            : undefined;
    const visibleUsage = resolveSuncokretVisibleUsage({
        streamingText: messageTextContent(streamingMessage),
        usage: statusInfo?.usage,
    });
    const contextSuggestions = suncokretContextSuggestions(uiContext);
    const isCloseup = view === 'closeup';

    return (
        <>
            {!isCloseup && (
                <HudCard
                    open
                    position="floating"
                    className="static border-amber-400 bg-amber-100 p-0 dark:border-amber-700 dark:bg-amber-950"
                    data-suncokret-hud-trigger
                >
                    <SuncokretChatTrigger
                        action="toggle-default"
                        title="Suncokret AI"
                        variant="hud"
                    />
                </HudCard>
            )}
            {open && (
                <SuncokretChatPositioner
                    anchorElement={chat.anchorElement}
                    isCloseup={isCloseup}
                    onClose={chat.closeChat}
                >
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
                                        src="https://cdn.gredice.com/sunflower-large.svg"
                                        alt=""
                                        width={32}
                                        height={32}
                                        className="size-8"
                                    />
                                </span>
                                <Stack spacing={0} className="min-w-0">
                                    <Typography level="body2" semiBold noWrap>
                                        Suncokret
                                    </Typography>
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                        noWrap
                                    >
                                        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-500 align-middle" />
                                        Razgovor za {conversationLabel}
                                    </Typography>
                                </Stack>
                            </Row>
                            <Row spacing={1}>
                                {debug && models.length > 1 && (
                                    <select
                                        aria-label="AI model"
                                        data-suncokret-model-picker
                                        value={modelId ?? ''}
                                        onChange={(event) =>
                                            setModelId(
                                                event.target.value || null,
                                            )
                                        }
                                        className="h-8 max-w-32 rounded-full border bg-background px-2.5 text-xs"
                                    >
                                        {models.map((model) => (
                                            <option
                                                key={model.id}
                                                value={model.id}
                                            >
                                                {model.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <IconButton
                                    title="Zatvori"
                                    variant="plain"
                                    onClick={chat.closeChat}
                                >
                                    <Close className="size-4" />
                                </IconButton>
                            </Row>
                        </Row>

                        <ChatMessageScroller
                            ariaBusy={loading}
                            ariaLabel="Razgovor sa Suncokretom"
                            className="flex-1"
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
                                        {contextSuggestions.map(
                                            (suggestion, index) => (
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
                                                    onClick={() =>
                                                        sendPrompt(
                                                            suggestion.prompt,
                                                        )
                                                    }
                                                >
                                                    {suggestion.label}
                                                </Button>
                                            ),
                                        )}
                                    </Stack>
                                </Stack>
                            }
                            items={[
                                ...messages.map((message) => ({
                                    id: message.id,
                                    scrollAnchor: message.role === 'user',
                                    content: (
                                        <ChatMessage
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
                                        />
                                    ),
                                })),
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
                            {visibleUsage && (
                                <div
                                    className="grid gap-2 rounded-xl bg-muted/40 px-3 py-2"
                                    data-suncokret-usage
                                >
                                    <UsagePeriodIndicator
                                        label="Danas"
                                        period={visibleUsage.day}
                                    />
                                    <UsagePeriodIndicator
                                        label="Ovaj tjedan"
                                        period={visibleUsage.week}
                                    />
                                </div>
                            )}
                            {blocked && (
                                <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                                    Dnevni limit je iskorišten. Nastavak je
                                    moguć {formatRetryAt(limit?.retryAt)}.
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
                                    disabled={loading || blocked}
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
                    </div>
                </SuncokretChatPositioner>
            )}
        </>
    );
}
