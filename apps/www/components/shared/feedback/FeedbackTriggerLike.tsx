import { IconButton } from '@gredice/ui/IconButton';
import { ThumbsDown, ThumbsUp } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { cx } from '@gredice/ui/utils';
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

export type FeedbackTriggerProps = {
    onFeedback: (feedback: 'like' | 'dislike') => void;
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    ref?: React.Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'>;

export function FeedbackTrigger({
    className,
    onFeedback,
    onClick,
    'aria-haspopup': ariaHaspopup,
    'aria-expanded': ariaExpanded,
    'aria-controls': ariaControls,
    ...rest
}: FeedbackTriggerProps) {
    const isExpanded = ariaExpanded === true || ariaExpanded === 'true';
    function handleLike(
        event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    ) {
        onFeedback('like');
        onClick?.(event);
    }
    function handleDislike(
        event: React.MouseEvent<HTMLButtonElement, MouseEvent>,
    ) {
        onFeedback('dislike');
        onClick?.(event);
    }

    return (
        <Row
            spacing={1}
            className={cx('w-fit', className)}
            {...(rest as HTMLAttributes<HTMLDivElement>)}
        >
            <IconButton
                type="button"
                aria-haspopup={ariaHaspopup}
                aria-expanded={ariaExpanded}
                aria-controls={isExpanded ? ariaControls : undefined}
                size="sm"
                className="p-1 size-6"
                variant="plain"
                title="Ne sviđa mi se"
                onClick={handleDislike}
            >
                <ThumbsDown />
            </IconButton>
            <IconButton
                type="button"
                aria-haspopup={ariaHaspopup}
                aria-expanded={ariaExpanded}
                aria-controls={isExpanded ? ariaControls : undefined}
                size="sm"
                className="p-1 size-6"
                variant="plain"
                title="Sviđa mi se"
                onClick={handleLike}
            >
                <ThumbsUp />
            </IconButton>
        </Row>
    );
}
