import { Button, type ButtonButtonProps } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';

/**
 * The one look for "something is missing, suggest it": a dashed card that sits
 * in the grid it extends. Every suggestion trigger on the public pages uses it.
 */
export function CommunitySuggestionCard({
    className,
    helper,
    srContext,
    title,
    ...rest
}: Omit<
    ButtonButtonProps,
    'children' | 'color' | 'size' | 'title' | 'variant'
> & {
    title: string;
    helper?: string;
    /** Extra context for assistive technology, for example the group name. */
    srContext?: string;
}) {
    return (
        <Button
            className={cx(
                'h-auto min-h-16 w-full justify-start gap-3 whitespace-normal rounded-lg border-dashed border-muted-foreground/40 bg-card/40 p-3 text-left font-normal hover:border-muted-foreground/60 hover:bg-card/70',
                className,
            )}
            color="neutral"
            type="button"
            variant="outlined"
            {...rest}
        >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground">
                <Add aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
                <Typography component="span" semiBold>
                    {title}
                    {srContext ? (
                        <span className="sr-only"> – {srContext}</span>
                    ) : null}
                </Typography>
                {helper ? (
                    <Typography
                        className="text-pretty text-muted-foreground"
                        component="span"
                        level="body2"
                    >
                        {helper}
                    </Typography>
                ) : null}
            </span>
        </Button>
    );
}
