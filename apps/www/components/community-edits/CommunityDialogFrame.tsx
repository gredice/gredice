'use client';

import { Modal } from '@gredice/ui/Modal';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';
import type { ReactNode } from 'react';
import { communityReviewPromise } from './communitySuggestionUtils';

/**
 * Shared shell of the community dialogs: what the suggestion is about, the
 * title and the review promise. Forms end with `CommunityDialogFooter`.
 */
export function CommunityDialogFrame({
    children,
    context,
    description = communityReviewPromise,
    onOpenChange,
    open,
    size = 'md',
    title,
}: {
    children: ReactNode;
    /** What the suggestion is about, for example "Rajčica · Sijanje". */
    context?: string | null;
    /** Line under the title. Defaults to the review promise. */
    description?: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    size?: 'md' | 'lg';
    title: string;
}) {
    return (
        <Modal
            className={cx(
                size === 'lg' ? 'max-w-4xl' : 'max-w-2xl',
                'border-border/70 shadow-xl',
            )}
            onOpenChange={onOpenChange}
            open={open}
            title={title}
        >
            <div className="flex min-w-0 flex-col gap-5">
                <div className="flex flex-col gap-1 md:pr-6">
                    {context ? (
                        <Typography
                            className="font-semibold uppercase tracking-wider text-brand"
                            data-community-dialog-context
                            level="body3"
                        >
                            {context}
                        </Typography>
                    ) : null}
                    {/* The dialog's own (visually hidden) title is the heading. */}
                    <Typography aria-hidden component="p" level="h4">
                        {title}
                    </Typography>
                    <Typography level="body2" className="text-muted-foreground">
                        {description}
                    </Typography>
                </div>
                {children}
            </div>
        </Modal>
    );
}
