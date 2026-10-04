import { Button } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import { CommunityEntitySuggestionButton } from '../../../components/community-edits/CommunityEntitySuggestionButton';
import { KnownPages } from '../../../src/KnownPages';

export function PlantSortSuggestionCard({
    basePlantId,
    basePlantName,
}: {
    basePlantId: number;
    basePlantName: string;
}) {
    return (
        <CommunityEntitySuggestionButton
            kind="plantSort"
            parentPlantId={basePlantId}
            parentPlantName={basePlantName}
            publicPath={KnownPages.Plant(basePlantName)}
            trigger={
                <Button
                    type="button"
                    variant="outlined"
                    color="neutral"
                    className="h-auto min-h-24 w-full justify-start gap-4 rounded-lg border-dashed border-muted-foreground/40 bg-card/40 p-2 text-left font-normal hover:border-muted-foreground/60 hover:bg-card/70"
                >
                    <span className="flex size-18 shrink-0 items-center justify-center text-muted-foreground">
                        <Add aria-hidden className="size-8" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <Typography component="span" level="h5">
                            Predloži novu sortu
                        </Typography>
                        <Typography
                            component="span"
                            level="body1"
                            className="text-muted-foreground"
                        >
                            Poznaješ sortu koja nedostaje? Predloži je za naš
                            popis.
                        </Typography>
                    </span>
                </Button>
            }
        />
    );
}
