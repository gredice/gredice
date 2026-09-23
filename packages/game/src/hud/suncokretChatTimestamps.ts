import { getAiChatMessageTimestamp } from '@gredice/js/ai';
import type { UIMessage } from 'ai';
import type { SuncokretChatSeed } from './SuncokretChatProvider';

export function groupSuncokretMessageTimestamps(
    messages: UIMessage[],
    seed?: SuncokretChatSeed,
) {
    let previousTimestamp: Date | undefined;
    const seedTimestamps = new Map(
        seed?.messages.map((message, index) => [
            `${seed.id}-${index}`,
            getAiChatMessageTimestamp(message),
        ]),
    );

    return messages.map((message) => {
        // Old review conversations predate timestamp metadata. The diary event
        // still supplies the actual analysis date, even after restoring a chat.
        const timestamp =
            seedTimestamps.get(message.id) ??
            getAiChatMessageTimestamp(message.metadata);
        const startsGroup =
            timestamp &&
            (!previousTimestamp ||
                timestamp.toDateString() !== previousTimestamp.toDateString() ||
                timestamp.getTime() - previousTimestamp.getTime() >=
                    60 * 60 * 1000);
        if (timestamp) previousTimestamp = timestamp;
        return { message, timestamp: startsGroup ? timestamp : undefined };
    });
}
