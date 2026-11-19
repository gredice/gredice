'use client';

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
            triggerContext={groupLabel}
        />
    );
}
