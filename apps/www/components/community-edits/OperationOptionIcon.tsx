import { OperationCategoryIcon } from '@gredice/ui/OperationImage';
import type { CommunityEditableFieldOption } from './communityEditFields';

export function OperationOptionIcon({
    option,
}: {
    option: CommunityEditableFieldOption;
}) {
    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border/70 bg-background text-foreground">
            <OperationCategoryIcon
                variant="game"
                aria-hidden
                categoryName={option.iconKey}
                className="size-6"
            />
        </span>
    );
}
