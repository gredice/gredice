export type CommunityOperationSuggestionStage = {
    id: number;
    label: string;
};

export type CommunitySuggestionPlantOption = {
    value: string;
    label: string;
};

type CommonProps = {
    className?: string;
    /**
     * @deprecated Every suggestion trigger is the same card now, so this no
     * longer changes anything.
     */
    compact?: boolean;
    publicPath: string;
    /**
     * Context added to the trigger's accessible name when several triggers
     * of one kind share a page, for example the group the card belongs to.
     */
    triggerContext?: string;
};

export type CommunityEntitySuggestionButtonProps = CommonProps &
    (
        | (({ kind: 'plantSort' } | { kind: 'plantTip' }) & {
              parentPlantId: number;
              parentPlantName: string;
          })
        | {
              kind: 'operation';
              stages: CommunityOperationSuggestionStage[];
              defaultStageId?: number;
          }
        | {
              kind: 'disease' | 'pest';
              plants: CommunitySuggestionPlantOption[];
              defaultAffectedPlantId?: number;
          }
    );

export type CommunityEntitySuggestionKind =
    CommunityEntitySuggestionButtonProps['kind'];
