import type { FaqData } from '@gredice/client';
import { Accordion } from '@gredice/ui/Accordion';
import { Markdown } from '@gredice/ui/Markdown';
import { Typography } from '@gredice/ui/Typography';

export function FaqAnswer({ entry }: { entry: FaqData }) {
    return (
        <Accordion
            className="h-min border-tertiary border-b-4"
            id={`pitanje-${entry.slug}`}
        >
            <Typography component="span" className="px-3" semiBold>
                {entry.information.header}
            </Typography>
            <div className="px-3">
                <Markdown>{entry.information.content}</Markdown>
            </div>
        </Accordion>
    );
}
