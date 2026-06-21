'use client';

import { useChat } from '@ai-sdk/react';
import { getBrowserGrediceAppOrigin } from '@gredice/client';
import { Button } from '@gredice/ui/Button';
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
import { Markdown } from '@gredice/ui/Markdown';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Image from 'next/image';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useGameFlags } from '../GameFlagsContext';
import { useCurrentGarden } from '../hooks/useCurrentGarden';
import { useGameState } from '../useGameState';
import { findRaisedBedByBlockId } from '../utils/raisedBedBlocks';

type SuncokretLimit = {
    dailyLimitUsd: number;
    remainingUsd: number;
    retryAt: string;
    blockedReason: string | null;
    trialChatDaysUsed: number;
    trialChatDaysLimit: number;
};

type SuncokretStatus = {
    enabled: boolean;
    model: { id: string; label: string } | null;
    limit: SuncokretLimit;
};

type SuncokretModel = {
    id: string;
    label: string;
};

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
            return 'Provjeravam polja u gredici';
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
    return state === 'output-available' || state === 'result';
}

function isToolErrorState(state: string) {
    return state === 'output-error' || state === 'error';
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

function formatUsd(value: number | null | undefined) {
    if (value == null) return '-';
    return new Intl.NumberFormat('hr-HR', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: value > 0 && value < 0.01 ? 4 : 2,
    }).format(value);
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

function MessageText({ children }: { children: string }) {
    return (
        <Markdown className="prose-sm max-w-none text-sm leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
            {children}
        </Markdown>
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
        <div className="rounded-md border bg-muted/30 p-2 text-xs">
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
                'listGardenOperations',
                'getRaisedBedAiHistory',
            ].includes(name),
        )
            ? 'vrt'
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

    return (
        <div
            className={cx(
                'flex w-full',
                isUser ? 'justify-end' : 'justify-start',
            )}
        >
            <Stack
                spacing={1}
                className={cx(
                    'max-w-[88%] rounded-md border px-3 py-2',
                    isUser
                        ? 'border-primary/30 bg-primary/10'
                        : 'border-border bg-background/95',
                )}
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
                        return <MessageText key={key}>{text}</MessageText>;
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
                    <Row
                        spacing={2}
                        className={cx(
                            'rounded-md border border-dashed px-2 py-1.5 text-muted-foreground',
                            hasToolError
                                ? 'border-amber-300 bg-amber-50 text-amber-900'
                                : 'bg-muted/30',
                        )}
                    >
                        {hasToolError ? (
                            <Warning className="size-3.5 shrink-0" />
                        ) : hasRunningTool || isStreaming ? (
                            <LoaderSpinner className="size-3.5 shrink-0 animate-spin" />
                        ) : (
                            <AI className="size-3.5 shrink-0" />
                        )}
                        <Typography level="body3">
                            {toolActivitySummary({
                                isStreaming,
                                parts: passiveToolParts,
                            })}
                        </Typography>
                    </Row>
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
            </Stack>
        </div>
    );
}

export function SuncokretChatHud() {
    const flags = useGameFlags();
    const enabled = Boolean(flags.enableSuncokretChatFlag);
    const debug = Boolean(flags.enableSuncokretDebugFlag);
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState('');
    const [statusInfo, setStatusInfo] = useState<SuncokretStatus | null>(null);
    const [models, setModels] = useState<SuncokretModel[]>([]);
    const [modelId, setModelId] = useState<string | null>(null);
    const chatId = useMemo(randomChatId, []);
    const scrollRef = useRef<HTMLDivElement>(null);
    const apiOrigin = getBrowserGrediceAppOrigin('api');
    const { data: currentGarden } = useCurrentGarden();
    const closeupBlock = useGameState((state) => state.closeupBlock);
    const raisedBed = closeupBlock
        ? findRaisedBedByBlockId(currentGarden, closeupBlock.id)
        : null;
    const gardenId = currentGarden?.id ?? null;
    const raisedBedId = raisedBed?.id ?? null;

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: `${apiOrigin}/api/ai/suncokret/chat`,
                credentials: 'include',
                prepareSendMessagesRequest: ({ id, messages }) => ({
                    body: {
                        id,
                        conversationId: id,
                        messages,
                        gardenId,
                        raisedBedId,
                        modelId,
                        debug,
                    },
                    credentials: 'include',
                }),
            }),
        [apiOrigin, debug, gardenId, modelId, raisedBedId],
    );

    const { addToolApprovalResponse, error, messages, sendMessage, status } =
        useChat({
            id: chatId,
            transport,
            experimental_throttle: 80,
        });

    const loading = status === 'submitted' || status === 'streaming';

    useEffect(() => {
        if (!enabled || !open) {
            return;
        }

        let cancelled = false;
        void Promise.all([
            fetch(`${apiOrigin}/api/ai/suncokret/status`, {
                credentials: 'include',
            }).then((response) => response.json() as Promise<SuncokretStatus>),
            fetch(`${apiOrigin}/api/ai/suncokret/models`, {
                credentials: 'include',
            }).then(
                (response) =>
                    response.json() as Promise<{ models?: SuncokretModel[] }>,
            ),
        ])
            .then(([nextStatus, modelPayload]) => {
                if (cancelled) return;
                setStatusInfo(nextStatus);
                const nextModels = modelPayload.models ?? [];
                setModels(nextModels);
                setModelId(
                    (current) => current ?? nextStatus.model?.id ?? null,
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setStatusInfo(null);
                    setModels([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [apiOrigin, enabled, open]);

    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
        });
    });

    if (!enabled) {
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

    return (
        <>
            <div className="pointer-events-auto">
                <IconButton
                    title="Suncokret AI"
                    variant="plain"
                    onClick={() => setOpen((current) => !current)}
                    className={cx(
                        'bg-background/90 hover:bg-muted shadow-sm',
                        open && 'bg-muted',
                    )}
                >
                    <Sun className="size-5 text-amber-500" />
                </IconButton>
            </div>
            {open && (
                <div className="pointer-events-auto fixed inset-x-2 bottom-2 z-50 flex justify-center md:inset-auto md:right-2 md:bottom-14 md:block">
                    <div className="flex h-[min(680px,calc(100dvh-1rem))] w-full max-w-[430px] flex-col overflow-hidden rounded-md border border-tertiary border-b-4 bg-background shadow-xl md:h-[min(720px,calc(100dvh-5rem))]">
                        <Row
                            justifyContent="space-between"
                            className="border-b bg-muted/40 px-3 py-2"
                        >
                            <Row spacing={2} className="min-w-0">
                                <Image
                                    src="https://cdn.gredice.com/sunflower-large.svg"
                                    alt=""
                                    width={32}
                                    height={32}
                                    className="size-8 shrink-0"
                                />
                                <Stack spacing={0} className="min-w-0">
                                    <Typography level="body2" semiBold noWrap>
                                        Suncokret
                                    </Typography>
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                        noWrap
                                    >
                                        {raisedBed
                                            ? raisedBed.name
                                            : (currentGarden?.name ??
                                              'Moj vrt')}
                                    </Typography>
                                </Stack>
                            </Row>
                            <Row spacing={1}>
                                {models.length > 1 && (
                                    <select
                                        aria-label="AI model"
                                        value={modelId ?? ''}
                                        onChange={(event) =>
                                            setModelId(
                                                event.target.value || null,
                                            )
                                        }
                                        className="h-8 max-w-36 rounded-md border bg-background px-2 text-xs"
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
                                    onClick={() => setOpen(false)}
                                >
                                    <Close className="size-4" />
                                </IconButton>
                            </Row>
                        </Row>

                        <div
                            ref={scrollRef}
                            className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
                        >
                            {messages.length === 0 && (
                                <Stack spacing={3} className="items-start">
                                    <Row spacing={2}>
                                        <AI className="mt-0.5 size-5 shrink-0 text-primary" />
                                        <Typography level="body2">
                                            Pitaj za stanje vrta, gredice,
                                            sijanje ili radnje.
                                        </Typography>
                                    </Row>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="xs"
                                            variant="soft"
                                            onClick={() =>
                                                sendPrompt(
                                                    raisedBed
                                                        ? 'Sažmi stanje ove gredice i predloži sljedeće korake.'
                                                        : 'Sažmi stanje mog vrta i predloži sljedeće korake.',
                                                )
                                            }
                                        >
                                            Stanje gredice
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="soft"
                                            onClick={() =>
                                                sendPrompt(
                                                    'Koje radnje su najvažnije ovaj tjedan?',
                                                )
                                            }
                                        >
                                            Plan za tjedan
                                        </Button>
                                        <Button
                                            size="xs"
                                            variant="soft"
                                            onClick={() =>
                                                sendPrompt(
                                                    'Što mogu posaditi sljedeće?',
                                                )
                                            }
                                        >
                                            Što posaditi
                                        </Button>
                                    </div>
                                </Stack>
                            )}
                            {messages.map((message) => (
                                <ChatMessage
                                    key={message.id}
                                    addToolApprovalResponse={
                                        addToolApprovalResponse
                                    }
                                    debug={debug}
                                    isStreaming={
                                        loading &&
                                        message.role === 'assistant' &&
                                        message.id ===
                                            messages[messages.length - 1]?.id
                                    }
                                    message={message}
                                />
                            ))}
                            {loading && (
                                <Row
                                    spacing={2}
                                    className="text-muted-foreground"
                                >
                                    <LoaderSpinner className="size-4 animate-spin" />
                                    <Typography level="body3">
                                        Suncokret razmišlja...
                                    </Typography>
                                </Row>
                            )}
                        </div>

                        <Stack spacing={1} className="border-t p-2">
                            {limit && (
                                <Row
                                    justifyContent="space-between"
                                    className="text-muted-foreground"
                                >
                                    <Typography level="body3">
                                        Preostalo danas
                                    </Typography>
                                    <Typography level="body3">
                                        {formatUsd(limit.remainingUsd)}
                                    </Typography>
                                </Row>
                            )}
                            {blocked && (
                                <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                                    Dnevni limit je iskorišten. Nastavak je
                                    moguć {formatRetryAt(limit?.retryAt)}.
                                </div>
                            )}
                            {error && (
                                <div className="rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
                                    {error.message}
                                </div>
                            )}
                            <form onSubmit={onSubmit} className="flex gap-2">
                                <textarea
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
                                    className="min-h-10 max-h-28 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-ring"
                                    placeholder="Pitaj Suncokret..."
                                />
                                <IconButton
                                    title="Pošalji"
                                    type="submit"
                                    disabled={
                                        loading ||
                                        blocked ||
                                        input.trim().length === 0
                                    }
                                    className="h-10 w-10 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {loading ? (
                                        <LoaderSpinner className="size-4 animate-spin" />
                                    ) : (
                                        <Send className="size-4" />
                                    )}
                                </IconButton>
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
                </div>
            )}
        </>
    );
}
