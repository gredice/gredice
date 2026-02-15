import { useCurrentGarden } from '../../hooks/useCurrentGarden';
import { getRaisedBedBlockIds } from '../../utils/raisedBedBlocks';
import { getPositionIndexFromGrid } from '../../utils/raisedBedOrientation';
import { RaisedBedFieldInvalidShape } from './RaisedBedFieldInvalidShape';
import { RaisedBedFieldItem } from './RaisedBedFieldItem';

export function RaisedBedField({
    gardenId,
    raisedBedId,
}: {
    gardenId: number;
    raisedBedId: number;
}) {
    const { data: garden } = useCurrentGarden();
    const raisedBed = garden?.raisedBeds.find((bed) => bed.id === raisedBedId);
    if (!raisedBed?.isValid) {
        return <RaisedBedFieldInvalidShape />;
    }

    const blockCount =
        garden && raisedBed
            ? Math.max(getRaisedBedBlockIds(garden, raisedBed.id).length, 1)
            : 1;
    const totalRows = blockCount * 3;
    const totalColumns = 3;

    const rows = Array.from({ length: totalRows }, (_, index) => ({
        id: `row-${index.toString()}`,
        index,
    }));
    const columns = Array.from({ length: totalColumns }, (_, index) => ({
        id: `col-${index.toString()}`,
        index,
    }));

    return (
        <>
            <div></div>
            <div
                className="size-full grid"
                style={{
                    gridTemplateRows: `repeat(${totalRows}, minmax(0, 1fr))`,
                }}
            >
                {rows.map((row) => (
                    <div
                        key={row.id}
                        className="size-full grid"
                        style={{
                            gridTemplateColumns: `repeat(${totalColumns}, minmax(0, 1fr))`,
                        }}
                    >
                        {columns.map((column) => {
                            const visualBlockIndex = Math.floor(row.index / 3);
                            const blockIndex =
                                blockCount - 1 - visualBlockIndex;
                            const rowWithinBlock = row.index % 3;
                            const columnWithinBlock = column.index;
                            const positionIndex =
                                getPositionIndexFromGrid(
                                    rowWithinBlock,
                                    columnWithinBlock,
                                    'vertical',
                                ) +
                                blockIndex * 9;

                            return (
                                <div
                                    key={`${row.id}-${column.id}`}
                                    className="size-full p-0.5"
                                >
                                    <RaisedBedFieldItem
                                        gardenId={gardenId}
                                        raisedBedId={raisedBedId}
                                        positionIndex={positionIndex}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </>
    );
}
