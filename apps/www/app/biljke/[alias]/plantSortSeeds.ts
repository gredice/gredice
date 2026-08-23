type SeedWithPlantSort = {
    information: {
        name: string;
        plantSort: {
            id: number;
        };
    };
};

export function selectSeedsForPlantSort<TSeed extends SeedWithPlantSort>(
    seeds: TSeed[],
    plantSortId: number,
): TSeed[] {
    return seeds
        .filter((seed) => seed.information.plantSort.id === plantSortId)
        .toSorted((left, right) =>
            left.information.name.localeCompare(
                right.information.name,
                'hr-HR',
            ),
        );
}
