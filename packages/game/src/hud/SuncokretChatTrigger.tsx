'use client';

import { IconButton } from '@gredice/ui/IconButton';
import { cx } from '@gredice/ui/utils';
import Image from 'next/image';
import { useGameFlags } from '../GameFlagsContext';
import {
    type SuncokretChatTarget,
    useSuncokretChat,
} from './SuncokretChatProvider';

export function SuncokretChatTrigger({
    action = 'open',
    className,
    target,
    title,
    variant = 'compact',
}: {
    action?: 'open' | 'toggle-default';
    className?: string;
    target?: SuncokretChatTarget;
    title: string;
    variant?: 'compact' | 'hud';
}) {
    const enabled = Boolean(useGameFlags().enableSuncokretChatFlag);
    const chat = useSuncokretChat();

    if (!enabled || !chat || (action === 'open' && !target)) {
        return null;
    }

    return (
        <IconButton
            aria-label={title}
            aria-expanded={action === 'toggle-default' ? chat.open : undefined}
            aria-haspopup="dialog"
            title={title}
            variant="plain"
            onClick={(event) => {
                if (action === 'toggle-default') {
                    chat.toggleDefaultChat(event.currentTarget);
                    return;
                }

                if (target) {
                    chat.openChat(target, event.currentTarget);
                }
            }}
            className={cx(
                'pointer-events-auto rounded-full bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-50 dark:hover:bg-amber-900',
                variant === 'compact' &&
                    'size-9 border border-amber-300 shadow-sm dark:border-amber-800',
                variant === 'hud' && 'size-10',
                chat.open && 'bg-amber-200 dark:bg-amber-900',
                className,
            )}
        >
            <Image
                src="https://cdn.gredice.com/sunflower-large.svg"
                alt=""
                aria-hidden="true"
                width={24}
                height={24}
                className={cx(
                    'shrink-0',
                    variant === 'hud' ? 'size-6' : 'size-5',
                )}
            />
        </IconButton>
    );
}
