import type { FaqData } from '@gredice/client';
import { Accordion } from '@gredice/ui/Accordion';
import { Markdown } from '@gredice/ui/Markdown';
import { Typography } from '@gredice/ui/Typography';
import { cx } from '@gredice/ui/utils';

export function FaqAnswer({
    entry,
    size = 'md',
}: {
    entry: FaqData;
    size?: 'md' | 'lg';
}) {
    return (
        <Accordion
            className={cx(
                'h-min border-tertiary border-b-4',
                size === 'lg' && 'rounded-2xl',
            )}
            id={`pitanje-${entry.slug}`}
        >
            <Typography
                component="span"
                className={cx(
                    'px-3',
                    size === 'lg' && 'py-0.5 font-semibold text-[17px]',
                )}
                semiBold
            >
                {entry.information.header}
            </Typography>
            <div className="px-3">
                <Markdown>{entry.information.content}</Markdown>
            </div>
        </Accordion>
    );
}
