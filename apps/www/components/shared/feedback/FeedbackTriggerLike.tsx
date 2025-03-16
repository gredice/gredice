import { cx } from "@signalco/ui-primitives/cx";
import { IconButton } from "@signalco/ui-primitives/IconButton";
import { Row, RowProps } from "@signalco/ui-primitives/Row";
import { ThumbsDown, ThumbsUp } from "lucide-react";

export type FeedbackTriggerProps = {
    onFeedback: (feedback: 'like' | 'dislike') => void;
    onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
    ref?: React.Ref<HTMLDivElement>;
} & Omit<RowProps, 'children' | 'onClick'>;

export function FeedbackTrigger({ className, onFeedback, onClick, ...rest }: FeedbackTriggerProps) {
    function handleLike(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        onFeedback('like');
        onClick?.(event);
    }
    function handleDislike(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
        onFeedback('dislike');
        onClick?.(event);
    }

    return (
        <Row spacing={0.5} className={cx("w-fit", className)} {...rest}>
            <IconButton
                size="sm"
                className="p-1 size-6"
                variant="plain"
                title="Ne sviđa mi se"
                onClick={handleDislike}>
                <ThumbsDown />
            </IconButton>
            <IconButton
                size="sm"
                className="p-1 size-6"
                variant="plain"
                title="Sviđa mi se"
                onClick={handleLike}>
                <ThumbsUp />
            </IconButton>
        </Row>
    )
}