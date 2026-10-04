import { GameTrophyIcon } from '@gredice/ui/GameIcons';
import { ExternalLink } from '@gredice/ui/icons';
import { Link } from '@gredice/ui/Link';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../knownPages';
import { AchievementsOverview } from '../../shared-ui/achievements/AchievementsOverview';

export function AchievementsTab() {
    return (
        <Stack spacing={8}>
            <Typography
                level="h4"
                className="hidden md:flex items-center gap-2"
            >
                <GameTrophyIcon aria-hidden className="size-8 shrink-0" />
                Postignuća
            </Typography>
            <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                    Otkrij sve značke, uvjete i nagrade koje možeš prikupiti.
                </p>
                <Link
                    href={KnownPages.GrediceAchievements}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-medium underline underline-offset-4"
                >
                    Vodič kroz sva postignuća
                    <ExternalLink aria-hidden className="size-4 shrink-0" />
                    <span className="sr-only">
                        {' '}
                        (otvara se u novoj kartici)
                    </span>
                </Link>
            </div>
            <AchievementsOverview />
        </Stack>
    );
}
