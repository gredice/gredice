import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';

/**
 * Action bar of a community dialog. It must be the last element of the dialog
 * content: it cancels the dialog padding and stays in view while the form
 * above it scrolls. Sticky offsets are measured inside the scroll container's
 * padding, so the bar is pulled down by that padding to sit on the edge.
 */
export function CommunityDialogFooter({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cx(
                'sticky -bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-10 -mx-4 -mb-[calc(env(safe-area-inset-bottom)+1rem)] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/70 bg-card px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:-bottom-6 md:-mx-6 md:-mb-6 md:px-6 md:pb-4',
                className,
            )}
            data-community-dialog-footer
        >
            {children}
        </div>
    );
}
