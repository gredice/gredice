import type { FaqData } from '@gredice/client';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { FaqAnswer } from './FaqAnswer';
import { FaqCategoryVisual } from './FaqCategoryVisual';

export function FaqCategorySection({
    category,
    entries,
}: {
    category: FaqData['attributes']['category'];
    entries: FaqData[];
}) {
    return (
        <Stack
            spacing={4}
            id={category.information.name}
            className="scroll-mt-28"
        >
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
                    <FaqAnswer key={item.id} entry={item} />
                ))}
            </div>
        </Stack>
    );
}
