import type { UIMessage } from 'ai';
import type { SuncokretChatSeed } from './SuncokretChatProvider';
import type { SuncokretConversationSummary } from './SuncokretConversationList';

type SuncokretConversationDetail = SuncokretConversationSummary & {
    messages: UIMessage[];
};

export function randomChatId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `suncokret-${Date.now().toString(36)}`;
}

export function seedMessages(seed: SuncokretChatSeed): UIMessage[] {
    return seed.messages.map((message, index) => ({
        id: `${seed.id}-${index.toString()}`,
        role: message.role,
        parts: [{ type: 'text', text: message.text }],
    }));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isNullableNumber(value: unknown): value is number | null {
    return value === null || typeof value === 'number';
}

export function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
}

export function isSuncokretConversationSummary(
    value: unknown,
): value is SuncokretConversationSummary {
    return (
        isRecord(value) &&
        typeof value.id === 'string' &&
        isNullableString(value.title) &&
        isNullableString(value.model) &&
        isNullableNumber(value.gardenId) &&
        isNullableNumber(value.raisedBedId) &&
        typeof value.createdAt === 'string' &&
        isNullableString(value.lastMessageAt)
    );
}

export function isUiMessage(value: unknown): value is UIMessage {
    return (
        isRecord(value) &&
        typeof value.id === 'string' &&
        ['system', 'user', 'assistant'].includes(
            typeof value.role === 'string' ? value.role : '',
        ) &&
        Array.isArray(value.parts)
    );
}

export function parseConversationListPayload(value: unknown) {
    if (!isRecord(value) || !Array.isArray(value.conversations)) {
        return null;
    }

    return value.conversations.every(isSuncokretConversationSummary)
        ? value.conversations
        : null;
}

export function parseConversationDetailPayload(
    value: unknown,
): SuncokretConversationDetail | null {
    if (!isRecord(value) || !isRecord(value.conversation)) {
        return null;
    }

    const conversation = value.conversation;
    const messages = conversation.messages;
    if (
        !isSuncokretConversationSummary(conversation) ||
        !Array.isArray(messages) ||
        !messages.every(isUiMessage)
    ) {
        return null;
    }

    return { ...conversation, messages };
}

export function textPart(part: unknown) {
    if (!isRecord(part) || part.type !== 'text') {
        return null;
    }

    return typeof part.text === 'string' ? part.text : null;
}

export function toolPart(part: unknown) {
    if (!isRecord(part)) {
        return null;
    }

    const type = typeof part.type === 'string' ? part.type : '';
    return type.startsWith('tool-') ? part : null;
}

export function messagePartKey(part: unknown) {
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

export function toolName(part: Record<string, unknown>) {
    const type = typeof part.type === 'string' ? part.type : '';
    return type.replace(/^tool-/, '');
}

export function toolActivityLabel(name: string) {
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
        case 'getDeliverySlots':
            return 'Provjeravam termine dostave';
        case 'listGardenOperations':
            return 'Provjeravam radnje';
        case 'getRaisedBedAiHistory':
            return 'Provjeravam ranije savjete';
        case 'searchDirectory':
        case 'getOperationsDirectory':
            return 'Pretražujem Gredice katalog';
        case 'searchProducts':
            return 'Provjeravam ponudu';
        case 'presentRecommendations':
            return 'Pripremam prijedloge';
        case 'getCart':
            return 'Provjeravam košaricu';
        case 'addProductToCart':
        case 'addOperationToCart':
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

export function approval(part: Record<string, unknown>) {
    return isRecord(part.approval) ? part.approval : null;
}

export function approvalId(part: Record<string, unknown>) {
    const approvalData = approval(part);
    return typeof approvalData?.id === 'string' ? approvalData.id : null;
}

export function toolState(part: Record<string, unknown>) {
    const approvalData = approval(part);
    if (typeof approvalData?.state === 'string') {
        return approvalData.state;
    }
    return typeof part.state === 'string' ? part.state : 'unknown';
}

export function isToolApprovalRequested(part: Record<string, unknown>) {
    return (
        toolState(part) === 'approval-requested' && Boolean(approvalId(part))
    );
}

export function isToolCompleteState(state: string) {
    return (
        state === 'output-available' ||
        state === 'result' ||
        state === 'approval-responded' ||
        state === 'output-denied'
    );
}

export function isToolErrorState(state: string) {
    return state === 'output-error' || state === 'error';
}

export function isToolDeniedState(state: string) {
    return state === 'output-denied';
}

export function isToolApprovalRespondedState(state: string) {
    return state === 'approval-responded';
}

export function isToolRunningState(state: string) {
    return (
        !isToolCompleteState(state) &&
        !isToolErrorState(state) &&
        state !== 'approval-requested'
    );
}

export function isCompletedRecommendationPart(part: Record<string, unknown>) {
    const state = toolState(part);
    return (
        toolName(part) === 'presentRecommendations' &&
        (state === 'output-available' || state === 'result')
    );
}

export function debugJson(value: unknown) {
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export function formatRetryAt(value: string | null | undefined) {
    if (!value) return 'sutra';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'sutra';
    return new Intl.DateTimeFormat('hr-HR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export function messageTextContent(message: UIMessage | undefined) {
    if (!message) {
        return '';
    }

    return message.parts
        .map((part) => textPart(part) ?? '')
        .join('')
        .trim();
}

export function suncokretFlagParams({ debug }: { debug: boolean }) {
    const params = new URLSearchParams({
        enableSuncokretDebugFlag: debug ? 'true' : 'false',
    });
    return params.toString();
}

export function formatActivityScopes(scopes: string[]) {
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

export function toolActivityScope(parts: Record<string, unknown>[]) {
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
                'presentRecommendations',
            ].includes(name),
        )
            ? 'katalog'
            : null,
        names.some((name) =>
            [
                'getCart',
                'addProductToCart',
                'addOperationToCart',
                'updateCartItem',
                'prepareCheckout',
            ].includes(name),
        )
            ? 'košaricu'
            : null,
    ].filter((scope) => typeof scope === 'string');

    return formatActivityScopes(scopes);
}

export function toolActivitySummary({
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
