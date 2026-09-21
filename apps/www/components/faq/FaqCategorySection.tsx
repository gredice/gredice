import type { FaqData } from '@gredice/client';
import { Accordion } from '@gredice/ui/Accordion';
import { Markdown } from '@gredice/ui/Markdown';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { FaqCategoryVisual } from './FaqCategoryVisual';

export function FaqCategorySection({
    category,
    entries,
}: {
    category: FaqData['attributes']['category'];
    entries: FaqData[];
}) {
    return (
        <Stack spacing={4}>
            <div className="flex items-center gap-4">
                <FaqCategoryVisual
                    category={category}
                    className="size-14 sm:size-16"
                />
                <Typography level="h4" component="h2">
                    {category.information.label}
                </Typography>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {entries.map((item) => (
                    <Accordion
                        key={item.id}
                        className="h-min border-tertiary border-b-4"
                    >
                        <Typography className="px-3" semiBold>
                            {item.information.header}
                        </Typography>
                        <div className="px-3">
                            <Markdown>{item.information.content}</Markdown>
                        </div>
                    </Accordion>
                ))}
            </div>
        </Stack>
    );
}
