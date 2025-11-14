export type RaisedBedOrientation = 'vertical' | 'horizontal';

export function getPositionIndexFromGrid(
    rowIndex: number,
    colIndex: number,
    orientation: RaisedBedOrientation,
): number {
    if (orientation === 'horizontal') {
        return (2 - colIndex) * 3 + rowIndex;
    }

    return (2 - rowIndex) * 3 + (2 - colIndex);
}

export function getGridPositionFromIndex(
    index: number,
    orientation: RaisedBedOrientation,
): { row: number; col: number } {
    const baseRow = Math.floor(index / 3);
    const baseCol = index % 3;

    if (orientation === 'horizontal') {
        return {
            row: baseCol,
            col: 2 - baseRow,
        };
    }

    return {
        row: 2 - baseRow,
        col: 2 - baseCol,
    };
}
