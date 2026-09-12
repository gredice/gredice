import type { PublicGardenResponse } from '@gredice/client';
import { Calendar, Sprout } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { PublicGardenLikeButton } from './PublicGardenLikeButton';
import { formatGardenDate, formatGardenNumber } from './publicGardenFormatting';

export function PublicGardenSummary({
    garden,
    activePlantCount,
}: {
    garden: Pick<PublicGardenResponse, 'id' | 'createdAt' | 'likeCount'>;
    activePlantCount: number;
}) {
    return (
        <div className="grid grid-cols-3 divide-x border-t bg-card">
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-3 sm:flex-row sm:gap-2 sm:px-5">
                <Calendar
                    aria-hidden
                    className="size-4 shrink-0 text-primary"
                />
                <div className="min-w-0 text-center sm:text-left">
                    <Typography level="body3" className="text-muted-foreground">
                        Stvoren
                    </Typography>
                    <Typography level="body2" className="font-medium">
                        <time dateTime={garden.createdAt}>
                            {formatGardenDate(garden.createdAt)}
                        </time>
                    </Typography>
                </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-1 px-2 py-3 sm:flex-row sm:gap-2 sm:px-5">
                <Sprout aria-hidden className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 text-center sm:text-left">
                    <Typography level="body3" className="text-muted-foreground">
                        Biljaka
                    </Typography>
                    <Typography level="body2" className="font-medium">
                        {formatGardenNumber(activePlantCount)}
                    </Typography>
                </div>
            </div>
            <PublicGardenLikeButton
                key={garden.id}
                className="sm:px-2"
                gardenId={garden.id}
                initialLikeCount={
                    Number.isFinite(garden.likeCount) ? garden.likeCount : 0
                }
            />
        </div>
    );
}
