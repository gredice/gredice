'use client';

import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';
import { cx } from '../utils';

export type ChatMessageResponseProps = ComponentProps<typeof Streamdown>;

export const ChatMessageResponse = memo(
    function ChatMessageResponse({
        className,
        controls = { table: false },
        ...props
    }: ChatMessageResponseProps) {
        return (
            <Streamdown
                className={cx(
                    'w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
                    className,
                )}
                controls={controls}
                {...props}
            />
        );
    },
    (previous, next) =>
        previous.children === next.children &&
        previous.isAnimating === next.isAnimating,
);

ChatMessageResponse.displayName = 'ChatMessageResponse';
