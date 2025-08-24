import { Button, type ButtonProps } from '@signalco/ui-primitives/Button';
import { cx } from '@signalco/ui-primitives/cx';

export function ButtonGreen({ className, ...rest }: ButtonProps) {
    return (
        <Button
            className={cx(
                'min-h-10',
                'bg-gradient-to-br from-lime-100/90 dark:from-lime-200/80 to-lime-100/80 dark:to-lime-200/70 hover:bg-white dark:hover:bg-white/50',
                'text-primary dark:text-primary-foreground dark:hover:text-primary-foreground/80 hover:text-primary/80',
                'transition-colors',
                className,
            )}
            {...rest}
        />
    );
}
