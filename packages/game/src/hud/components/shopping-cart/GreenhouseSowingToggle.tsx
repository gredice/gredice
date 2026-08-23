import { Sprout } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';

export function GreenhouseSowingToggle({
    checked,
    disabled,
    onCheckedChange,
}: {
    checked: boolean;
    disabled?: boolean;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label="Staklenik"
            title={
                checked
                    ? 'Isključi sijanje u stakleniku'
                    : 'Uključi sijanje u stakleniku'
            }
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cx(
                'inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-1.5 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                checked
                    ? 'border-green-500 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-100'
                    : 'border-border bg-muted/70 text-muted-foreground hover:bg-muted',
            )}
        >
            <Sprout className="size-3.5 shrink-0" />
            <span>Staklenik</span>
        </button>
    );
}
