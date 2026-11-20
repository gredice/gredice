import { Check, Warning } from '@gredice/ui/icons';
import { cx } from '@gredice/ui/utils';

/**
 * Result of the last save of a settings form. The live region stays mounted
 * while empty so that screen readers announce the message when it appears.
 */
export function SettingsFormMessage({
    state,
    className,
}: {
    state: { success: boolean; message: string } | null;
    className?: string;
}) {
    return (
        <p
            role="status"
            className={cx(
                'flex min-w-0 items-center gap-1.5 text-sm',
                state?.success
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-red-700 dark:text-red-400',
                className,
            )}
        >
            {state && (
                <>
                    {state.success ? (
                        <Check className="size-4 shrink-0" aria-hidden />
                    ) : (
                        <Warning className="size-4 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">{state.message}</span>
                </>
            )}
        </p>
    );
}
