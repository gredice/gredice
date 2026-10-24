/** Read the ISO timestamp shared by streamed, seeded, and stored chat messages. */
export function getAiChatMessageTimestamp(metadata: unknown) {
    if (
        !metadata ||
        typeof metadata !== 'object' ||
        !('createdAt' in metadata) ||
        typeof metadata.createdAt !== 'string'
    ) {
        return undefined;
    }
    const timestamp = new Date(metadata.createdAt);
    return Number.isNaN(timestamp.getTime()) ? undefined : timestamp;
}

/** Tool approval continuations retain the timestamp of the existing reply. */
export function getAiChatResponseTimestamp(
    messages: unknown[],
    now = new Date(),
) {
    const lastMessage = messages.at(-1);
    if (
        lastMessage &&
        typeof lastMessage === 'object' &&
        'role' in lastMessage &&
        lastMessage.role === 'assistant' &&
        'metadata' in lastMessage
    ) {
        return getAiChatMessageTimestamp(lastMessage.metadata) ?? now;
    }
    return now;
}
