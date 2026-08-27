import { Chip } from '@gredice/ui/Chip';
import { OperationImage } from '@gredice/ui/OperationImage';
import type { OperationsListDayBubble } from '../../app/admin/operations/operationsListGrouping';

export function OperationsDayBubbles({
    bubbles,
    overflowCount,
}: {
    bubbles: OperationsListDayBubble[];
    overflowCount: number;
}) {
    if (!bubbles.length) {
        return null;
    }

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            {bubbles.map((bubble) => (
                <Chip
                    key={bubble.key}
                    color={bubble.kind === 'sowing' ? 'success' : 'neutral'}
                    size="lg"
                    variant="outlined"
                    title={`${bubble.label} (${bubble.count})`}
                    startDecorator={
                        <OperationImage
                            operation={bubble.operationDefinition}
                            size={24}
                            className="size-6"
                        />
                    }
                >
                    {bubble.count}
                    <span className="sr-only">{bubble.label}</span>
                </Chip>
            ))}
            {overflowCount > 0 ? (
                <Chip
                    color="neutral"
                    size="lg"
                    variant="outlined"
                    title={`Još ${overflowCount} zapisa`}
                >
                    +{overflowCount}
                </Chip>
            ) : null}
        </div>
    );
}
