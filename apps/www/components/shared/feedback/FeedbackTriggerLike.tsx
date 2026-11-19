import { Button } from '@gredice/ui/Button';
import { IconButton } from '@gredice/ui/IconButton';
import { ThumbsDown, ThumbsUp } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { cx } from '@gredice/ui/utils';
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

export type FeedbackTriggerProps = {
    onFeedback: (feedback: 'like' | 'dislike') => void;
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    ref?: React.Ref<HTMLButtonElement>;
    /**
     * Shows "Da" and "Ne" with visible text for answering a question placed
     * next to the trigger, instead of the two bare thumb icons.
     */
    labeled?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onClick'>;

export function FeedbackTrigger({
    className,
    onFeedback,
    onClick,
    labeled = false,
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

    if (labeled) {
        return (
            <Row
                spacing={1}
                className={cx('w-fit', className)}
                {...(rest as HTMLAttributes<HTMLDivElement>)}
            >
                <Button
                    type="button"
                    aria-haspopup={ariaHaspopup}
                    aria-expanded={ariaExpanded}
                    aria-controls={isExpanded ? ariaControls : undefined}
                    size="sm"
                    variant="outlined"
                    className="bg-card"
                    startDecorator={
                        <ThumbsUp aria-hidden className="size-4 shrink-0" />
                    }
                    title="Sviđa mi se"
                    onClick={handleLike}
                >
                    Da
                </Button>
                <Button
                    type="button"
                    aria-haspopup={ariaHaspopup}
                    aria-expanded={ariaExpanded}
                    aria-controls={isExpanded ? ariaControls : undefined}
                    size="sm"
                    variant="outlined"
                    className="bg-card"
                    startDecorator={
                        <ThumbsDown aria-hidden className="size-4 shrink-0" />
                    }
                    title="Ne sviđa mi se"
                    onClick={handleDislike}
                >
                    Ne
                </Button>
            </Row>
        );
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
