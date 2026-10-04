import type { UIMessage } from 'ai';
import type { SuncokretChatSeed } from '../SuncokretChatProvider';
import { isRecord, seedMessages } from '../suncokretChatUtils';

export type PhotoAnalysisAttachment = {
    positionIndex?: number;
    gardenId: number;
    entryName: string;
    imageUrls: string[];
};

export type PhotoAnalysisRequest = PhotoAnalysisAttachment & {
    key: string;
    referenceDate?: Date | string | null;
    historyEntryId?: number;
    historyEntries?: Array<{
        id: number;
        description: string | undefined;
        timestamp: Date;
        imageUrls?: string[] | null;
    }>;
};

export function photoAnalysisAttachment(
    metadata: unknown,
): PhotoAnalysisAttachment | undefined {
    const value = isRecord(metadata) ? metadata.photoAnalysis : undefined;
    if (
        !isRecord(value) ||
        typeof value.gardenId !== 'number' ||
        !Number.isInteger(value.gardenId) ||
        value.gardenId <= 0 ||
        typeof value.entryName !== 'string' ||
        !Array.isArray(value.imageUrls) ||
        !value.imageUrls.every((url): url is string => typeof url === 'string')
    )
        return undefined;
    return {
        ...(typeof value.positionIndex === 'number' &&
        Number.isInteger(value.positionIndex) &&
        value.positionIndex >= 0
            ? { positionIndex: value.positionIndex }
            : {}),
        gardenId: value.gardenId,
        entryName: value.entryName,
        imageUrls: value.imageUrls,
    };
}

/** Older review chats predate photo attachments; restore them from the diary seed. */
export function restoreAnalysisAttachments(
    messages: UIMessage[],
    seed?: SuncokretChatSeed,
) {
    if (!seed) return messages;
    const seeded = new Map(
        seedMessages(seed).map((message) => [message.id, message]),
    );
    return messages.map((message) => {
        const original = seeded.get(message.id);
        if (!original || !photoAnalysisAttachment(original.metadata))
            return message;
        return {
            ...message,
            metadata: {
                ...(isRecord(message.metadata) ? message.metadata : {}),
                ...(isRecord(original.metadata) ? original.metadata : {}),
            },
        };
    });
}
