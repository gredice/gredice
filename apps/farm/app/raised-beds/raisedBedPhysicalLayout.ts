/** Physical identifiers count from the bottom-right, including missing beds. */
export function getRaisedBedPhysicalLayout<
    T extends { id: number; physicalId: string | null },
>(raisedBeds: T[]) {
    const numbered = new Map<number, T[]>();
    const unnumbered: T[] = [];
    for (const bed of raisedBeds) {
        const position = Number(bed.physicalId);
        if (Number.isSafeInteger(position) && position > 0) {
            const beds = numbered.get(position) ?? [];
            beds.push(bed);
            numbered.set(position, beds);
        } else {
            unnumbered.push(bed);
        }
    }
    const rowCount = Math.ceil(Math.max(0, ...numbered.keys()) / 3);
    const extraRows = Math.ceil(unnumbered.length / 3);
    const slots = [
        ...unnumbered
            .toSorted((a, b) =>
                (b.physicalId ?? '').localeCompare(a.physicalId ?? '', 'hr', {
                    numeric: true,
                }),
            )
            .map((bed, index) => ({
                key: `bed-${bed.id}`,
                row: Math.floor(index / 3) + 1,
                column: (index % 3) + 1,
                beds: [bed],
            })),
        ...[...numbered.entries()]
            .sort(([a], [b]) => b - a)
            .map(([position, beds]) => ({
                key: `position-${position}`,
                row: extraRows + rowCount - Math.floor((position - 1) / 3),
                column: 3 - ((position - 1) % 3),
                beds: beds.toSorted((a, b) => b.id - a.id),
            })),
    ];
    return { slots, rowCount: rowCount + extraRows };
}
