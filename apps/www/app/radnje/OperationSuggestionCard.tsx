'use client';

import { Button } from '@gredice/ui/Button';
import { Add } from '@gredice/ui/icons';
import { Typography } from '@gredice/ui/Typography';
import {
    CommunityEntitySuggestionButton,
    type CommunityOperationSuggestionStage,
} from '../../components/community-edits/CommunityEntitySuggestionButton';
import { KnownPages } from '../../src/KnownPages';

export function OperationSuggestionCard({
    groupLabel,
    stageId,
    stages,
}: {
    groupLabel?: string;
    stageId?: number;
    stages: CommunityOperationSuggestionStage[];
}) {
    return (
        <CommunityEntitySuggestionButton
            kind="operation"
            publicPath={KnownPages.Operations}
            stages={stages}
            defaultStageId={stageId}
            trigger={
                <Button
                    type="button"
                    variant="outlined"
                    color="neutral"
                    aria-label={
                        groupLabel
                            ? `Predloži novu radnju: ${groupLabel}`
                            : undefined
                    }
                    className="h-full min-h-24 w-full justify-start gap-4 whitespace-normal rounded-lg border-dashed border-muted-foreground/40 bg-card/40 p-4 text-left font-normal hover:border-muted-foreground/60 hover:bg-card/70"
                >
                    <span className="flex size-18 shrink-0 items-center justify-center text-muted-foreground">
                        <Add aria-hidden className="size-8" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <Typography component="span" semiBold>
                            Predloži novu radnju
                        </Typography>
                        <Typography
                            component="span"
                            level="body2"
                            className="text-pretty text-muted-foreground"
                        >
                            Znaš radnju koja ovdje nedostaje? Predloži je za naš
                            popis.
                        </Typography>
                    </span>
                </Button>
            }
        />
    );
}
