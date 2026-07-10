'use client';

import { MessageScroller } from '@shadcn/react/message-scroller';
import type { HTMLAttributes, ReactNode } from 'react';
import { Down } from '../icons';
import { cx } from '../utils';

export type ChatMessageScrollerItem = {
    content: ReactNode;
    id: string;
    scrollAnchor?: boolean;
};

export type ChatMessageScrollerProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    'children'
> & {
    ariaBusy?: boolean;
    ariaLabel?: string;
    contentClassName?: string;
    emptyContent?: ReactNode;
    items: ChatMessageScrollerItem[];
    scrollButtonLabel?: string;
};

export function ChatMessageScroller({
    ariaBusy = false,
    ariaLabel = 'Razgovor',
    className,
    contentClassName,
    emptyContent,
    items,
    scrollButtonLabel = 'Najnovije poruke',
    ...props
}: ChatMessageScrollerProps) {
    return (
        <MessageScroller.Provider
            autoScroll
            defaultScrollPosition="end"
            scrollPreviousItemPeek={48}
        >
            <MessageScroller.Root
                className={cx(
                    'relative flex size-full min-h-0 flex-col overflow-hidden',
                    className,
                )}
                data-chat-message-scroller=""
                {...props}
            >
                <MessageScroller.Viewport
                    aria-label={ariaLabel}
                    className="size-full min-h-0 min-w-0 overflow-y-auto overscroll-contain"
                    data-chat-message-scroller-viewport=""
                >
                    <MessageScroller.Content
                        aria-busy={ariaBusy}
                        className={cx(
                            'flex h-max min-h-full flex-col gap-5 px-4 py-5',
                            contentClassName,
                        )}
                    >
                        {items.length > 0
                            ? items.map((item) => (
                                  <MessageScroller.Item
                                      className="min-w-0 shrink-0 [contain-intrinsic-size:auto_8rem] [content-visibility:auto]"
                                      key={item.id}
                                      messageId={item.id}
                                      scrollAnchor={item.scrollAnchor}
                                  >
                                      {item.content}
                                  </MessageScroller.Item>
                              ))
                            : emptyContent && (
                                  <MessageScroller.Item
                                      className="flex min-h-full min-w-0 flex-1 items-center justify-center"
                                      messageId="chat-empty-state"
                                  >
                                      {emptyContent}
                                  </MessageScroller.Item>
                              )}
                    </MessageScroller.Content>
                </MessageScroller.Viewport>
                <MessageScroller.Button
                    className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-sm transition-[transform,opacity] duration-200 hover:bg-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-[active=false]:pointer-events-none data-[active=false]:translate-y-3 data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100"
                    direction="end"
                    type="button"
                >
                    <Down className="size-3.5" />
                    <span>{scrollButtonLabel}</span>
                </MessageScroller.Button>
            </MessageScroller.Root>
        </MessageScroller.Provider>
    );
}
