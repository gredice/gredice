import type { useChat } from '@ai-sdk/react';
import {
    ChatBubble,
    ChatMarker,
    ChatMessage as ChatMessageLayout,
} from '@gredice/ui/Chat';
import { AI, Close, LoaderSpinner, Warning } from '@gredice/ui/icons';
import { sunflowerMascotArtwork } from '@gredice/ui/SunflowerVisuals';
import { cx } from '@gredice/ui/utils';
import type { UIMessage } from 'ai';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { SuncokretMessageText } from './SuncokretMessageText';
import { SuncokretToolPart } from './SuncokretToolPart';
import {
    debugJson,
    isCompletedRecommendationPart,
    isToolApprovalRequested,
    isToolApprovalRespondedState,
    isToolDeniedState,
    isToolErrorState,
    isToolRunningState,
    messagePartKey,
    textPart,
    toolActivitySummary,
    toolPart,
    toolState,
} from './suncokretChatUtils';

const SuncokretRecommendationChips = dynamic(
    () =>
        import('./SuncokretRecommendationChips').then(
            (module) => module.SuncokretRecommendationChips,
        ),
    { ssr: false },
);

export function SuncokretChatMessage({
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
    const keyedParts = message.parts.map((part) => {
        const baseKey = messagePartKey(part);
        const duplicateCount = partKeyCounts.get(baseKey) ?? 0;
        partKeyCounts.set(baseKey, duplicateCount + 1);

        return {
            key:
                duplicateCount === 0 ? baseKey : `${baseKey}:${duplicateCount}`,
            part,
        };
    });
    const completedRecommendationParts = keyedParts.flatMap(({ key, part }) => {
        const toolData = toolPart(part);
        return toolData && isCompletedRecommendationPart(toolData)
            ? [{ key, toolData }]
            : [];
    });
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
                        src={sunflowerMascotArtwork}
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
                {keyedParts.map(({ key, part }) => {
                    const text = textPart(part);
                    if (text) {
                        return (
                            <SuncokretMessageText
                                key={key}
                                isStreaming={isStreaming}
                            >
                                {text}
                            </SuncokretMessageText>
                        );
                    }

                    const toolData = toolPart(part);
                    if (toolData) {
                        if (isCompletedRecommendationPart(toolData)) {
                            return null;
                        }

                        if (!debug && !isToolApprovalRequested(toolData)) {
                            return null;
                        }

                        return (
                            <SuncokretToolPart
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
                {completedRecommendationParts.map(({ key, toolData }) => (
                    <div className="space-y-2" key={key}>
                        <SuncokretRecommendationChips
                            output={toolData.output ?? toolData.result}
                        />
                        {debug && (
                            <SuncokretToolPart
                                addToolApprovalResponse={
                                    addToolApprovalResponse
                                }
                                debug
                                part={toolData}
                            />
                        )}
                    </div>
                ))}
            </ChatBubble>
        </ChatMessageLayout>
    );
}
