import { Button } from '@gredice/ui/Button';
import { GameTrophyIcon } from '@gredice/ui/GameIcons';
import { Progress } from '@gredice/ui/Progress';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    acceptedSuggestionsLabel,
    communityRewardHint,
    nextCommunityEditingBadge,
} from '../../components/community-edits/communityRewards';
import { Card } from '../../components/shared/Card';
import { KnownPages } from '../../src/KnownPages';

/** Accepted suggestions so far and the distance to the next community badge. */
export function MySuggestionsProgress({
    acceptedCount,
}: {
    acceptedCount: number;
}) {
    const badge = nextCommunityEditingBadge(acceptedCount);
    const hint = communityRewardHint(acceptedCount);

    return (
        <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
                <GameTrophyIcon aria-hidden className="size-12 shrink-0" />
                <Stack spacing={2} className="min-w-0 flex-1 basis-64">
                    <Stack spacing={0.5}>
                        <Typography component="h2" level="h6" semiBold>
                            {acceptedCount > 0
                                ? acceptedSuggestionsLabel(acceptedCount)
                                : 'Još nema prihvaćenih prijedloga'}
                        </Typography>
                        <Typography level="body2">
                            {hint ??
                                'Sve značke za doprinos zajednici su osvojene.'}
                        </Typography>
                    </Stack>
                    {badge ? (
                        <Progress
                            aria-label={`Napredak do značke ${badge.title}`}
                            max={badge.threshold}
                            min={badge.previousThreshold}
                            trackClassName="bg-brand"
                            value={acceptedCount}
                        />
                    ) : null}
                </Stack>
                <Button
                    href={KnownPages.Achievements}
                    size="sm"
                    variant="outlined"
                >
                    Sva postignuća
                </Button>
            </div>
        </Card>
    );
}
