import { Button, type ButtonButtonProps } from '@gredice/ui/Button';
import { cx } from '@gredice/ui/utils';

type ScheduleTaskCompletionButtonProps = Omit<
    ButtonButtonProps,
    'aria-label' | 'children' | 'fullWidth' | 'size' | 'type'
> & {
    actionLabel: string;
    label: string;
};

export function ScheduleTaskCompletionButton({
    actionLabel,
    className,
    label,
    ...buttonProps
}: ScheduleTaskCompletionButtonProps) {
    return (
        <Button
            {...buttonProps}
            aria-label={`${actionLabel}: ${label}`}
            className={cx(
                'h-auto min-h-11 whitespace-normal py-2 [overflow-wrap:anywhere]',
                className,
            )}
            fullWidth
            size="lg"
            type="button"
        >
            {actionLabel}
        </Button>
    );
}
