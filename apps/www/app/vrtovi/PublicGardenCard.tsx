import type { PublicGardensResponse } from '@gredice/client';
import { GameSeedlingIcon } from '@gredice/ui/GameIcons';
import { Typography } from '@gredice/ui/Typography';
import { Card } from '../../components/shared/Card';
import { KnownPages } from '../../src/KnownPages';
import { PublicGardenLikeButton } from './PublicGardenLikeButton';
import { PublicGardenMembers } from './PublicGardenMembers';
import { PublicGardenPreviewImage } from './PublicGardenPreviewImage';
import { PublicGardenTransitionLink } from './PublicGardenTransitionLink';
import { formatGardenNumber } from './publicGardenFormatting';
import { getPublicGardenCardViewTransitionName } from './publicGardenViewTransition';

export function PublicGardenCard({
    garden,
    priority = false,
}: {
    garden: Omit<PublicGardensResponse['items'][number], 'members'> & {
        members?: PublicGardensResponse['items'][number]['members'];
    };
    priority?: boolean;
}) {
    return (
        <Card
            className="public-garden-card-view-transition group relative h-full overflow-hidden p-0 transition-shadow hover:shadow-sm"
            style={{
                viewTransitionName: getPublicGardenCardViewTransitionName(
                    garden.id,
                ),
            }}
        >
            <PublicGardenTransitionLink
                href={KnownPages.PublicGarden(garden.id)}
                className="absolute inset-0 z-10 rounded-lg"
                ariaLabel={`Otvori vrt ${garden.name}`}
            >
                <span className="sr-only">Otvori vrt {garden.name}</span>
            </PublicGardenTransitionLink>
            <div className="relative h-full text-card-foreground">
                <div className="relative overflow-hidden bg-muted">
                    <PublicGardenPreviewImage
                        dayPreviewImageUrl={
                            garden.previewImages?.day?.url ??
                            garden.previewImage?.url
                        }
                        gardenName={garden.name}
                        nightPreviewImageUrl={garden.previewImages?.night?.url}
                        priority={priority}
                    />
                    <div className="absolute top-3 left-3 z-20">
                        <PublicGardenMembers
                            gardenId={garden.id}
                            members={
                                garden.members ??
                                (garden.owner ? [garden.owner] : [])
                            }
                            compact
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 divide-x border-t bg-card">
                    <div className="flex items-center gap-2 px-3 py-3">
                        <GameSeedlingIcon
                            aria-hidden
                            className="size-5 shrink-0"
                        />
                        <div className="min-w-0">
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Biljaka
                            </Typography>
                            <Typography
                                level="body2"
                                className="truncate font-medium"
                            >
                                {formatGardenNumber(garden.activePlantCount)}
                            </Typography>
                        </div>
                    </div>
                    <PublicGardenLikeButton
                        gardenId={garden.id}
                        initialLikeCount={garden.likeCount}
                    />
                </div>
            </div>
        </Card>
    );
}
