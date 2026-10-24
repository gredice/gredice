import { sanitizeSuncokretAssistantText } from '@gredice/js/ai';
import { ChatMessageResponse } from '@gredice/ui/Chat';
export function SuncokretMessageText({
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
