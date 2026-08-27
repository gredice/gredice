import { Chip } from '@gredice/ui/Chip';
import type { OperationImageProps } from '@gredice/ui/OperationImage';
import { OperationImage } from '@gredice/ui/OperationImage';
import { PlantOrSortImage, type PlantSortLike } from '@gredice/ui/plants';
import type {
    GardenOperationsDayBubble,
    GardenOperationsDayBubbleItem,
} from './gardenOperationsDayGrouping';

/**
 * A bubble only needs what the images read, so full `OperationData` and
 * `PlantSortData` records satisfy it without the bubble depending on them.
 */
export type GardenOperationsBubbleItem = GardenOperationsDayBubbleItem & {
    operationData?: OperationImageProps['operation'];
    plantSortData?: PlantSortLike;
};

function BubbleMedia({ bubble }: { bubble: GardenOperationsBubbleItem }) {
    if (bubble.plantSortData) {
        return (
            <PlantOrSortImage
                plantSort={bubble.plantSortData}
                alt={bubble.label}
                width={24}
                height={24}
            />
        );
    }

    if (bubble.operationData) {
        return <OperationImage operation={bubble.operationData} size={24} />;
    }

    return null;
}

export function GardenOperationsDayBubbles({
    bubbles,
    overflowCount,
}: {
    bubbles: GardenOperationsDayBubble<GardenOperationsBubbleItem>[];
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
                    color={bubble.kind === 'planting' ? 'success' : 'neutral'}
                    size="lg"
                    variant="outlined"
                    title={`${bubble.label} (${bubble.count})`}
                    startDecorator={<BubbleMedia bubble={bubble} />}
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
                    title={`Još ${overflowCount} radnji`}
                >
                    +{overflowCount}
                </Chip>
            ) : null}
        </div>
    );
}
