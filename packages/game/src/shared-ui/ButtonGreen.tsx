import { Button, type ButtonProps } from '@gredice/ui/Button';
import { cx } from '@gredice/ui/utils';

export function ButtonGreen({ className, ...rest }: ButtonProps) {
    return (
        <Button
            className={cx(
                'min-h-10',
                'bg-gradient-to-br from-lime-100/90 to-lime-100/80 dark:from-emerald-950/95 dark:to-lime-950/90 hover:bg-white dark:hover:from-emerald-900/95 dark:hover:to-lime-900/90',
                'text-primary hover:text-primary/80 dark:text-lime-50 dark:hover:text-lime-100',
                'transition-colors',
                className,
            )}
            {...rest}
        />
    );
}
