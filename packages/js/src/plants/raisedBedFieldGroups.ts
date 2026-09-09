/** Three physical columns, displayed from the back of the bed toward the front. */
export function getRaisedBedFieldGroups(
    orderedPositions: readonly number[],
    plants: readonly { positionNumbers: readonly number[] }[],
) {
    const cells = orderedPositions.map((position, index) => ({
        position: position + 1,
        row: Math.floor(index / 3),
        column: index % 3,
    }));
    const groups = cells.map((cell) => ({
        top: cell.row,
        bottom: cell.row,
        left: cell.column,
        right: cell.column,
    }));

    // Merge the bounding cells of shared plantings. Include companion plants and
    // empty cells inside the rectangle; their exact field numbers remain visible.
    for (const plant of plants) {
        const occupied = cells.filter((cell) =>
            plant.positionNumbers.includes(cell.position),
        );
        if (occupied.length < 2) continue;
        let bounds = {
            top: Math.min(...occupied.map((cell) => cell.row)),
            bottom: Math.max(...occupied.map((cell) => cell.row)),
            left: Math.min(...occupied.map((cell) => cell.column)),
            right: Math.max(...occupied.map((cell) => cell.column)),
        };
        let merged = true;
        while (merged) {
            merged = false;
            for (let index = groups.length - 1; index >= 0; index--) {
                const group = groups[index];
                if (
                    !group ||
                    group.right < bounds.left ||
                    group.left > bounds.right ||
                    group.bottom < bounds.top ||
                    group.top > bounds.bottom
                )
                    continue;
                bounds = {
                    top: Math.min(bounds.top, group.top),
                    bottom: Math.max(bounds.bottom, group.bottom),
                    left: Math.min(bounds.left, group.left),
                    right: Math.max(bounds.right, group.right),
                };
                groups.splice(index, 1);
                merged = true;
            }
        }
        groups.push(bounds);
    }

    return groups
        .sort((a, b) => a.top - b.top || a.left - b.left)
        .map((group) => ({
            positionNumbers: cells
                .filter(
                    (cell) =>
                        cell.row >= group.top &&
                        cell.row <= group.bottom &&
                        cell.column >= group.left &&
                        cell.column <= group.right,
                )
                .map((cell) => cell.position),
            row: group.top + 1,
            column: group.left + 1,
            rowSpan: group.bottom - group.top + 1,
            columnSpan: group.right - group.left + 1,
        }));
}
