type GardenSelectionCandidate = {
    id: number;
    isDefault?: boolean;
    isSandbox: boolean;
};

type GardenSelectionGroup<
    TGarden extends GardenSelectionCandidate = GardenSelectionCandidate,
> = {
    accountId: string;
    gardens: readonly TGarden[];
    isCurrent: boolean;
};

export type ResolvedGardenSelection<
    TGarden extends GardenSelectionCandidate = GardenSelectionCandidate,
> = {
    accountId: string;
    garden: TGarden;
    isCurrent: boolean;
};

export function resolveExplicitGarden<TGarden extends GardenSelectionCandidate>(
    groups: readonly GardenSelectionGroup<TGarden>[] | null | undefined,
    gardenId: number,
): ResolvedGardenSelection<TGarden> | null {
    if (!groups) {
        return null;
    }

    for (const group of groups) {
        const garden = group.gardens.find(
            (candidate) => candidate.id === gardenId,
        );
        if (garden) {
            return {
                accountId: group.accountId,
                garden,
                isCurrent: group.isCurrent,
            };
        }
    }

    return null;
}

export function resolvePreferredGarden<
    TGarden extends GardenSelectionCandidate,
>(
    groups: readonly GardenSelectionGroup<TGarden>[] | null | undefined,
    selectedGardenId: number | null,
): ResolvedGardenSelection<TGarden> | null {
    if (!groups || groups.length === 0) {
        return null;
    }
    const availableGroups = groups;

    function findGarden(
        predicate: (garden: TGarden) => boolean,
        candidateGroups = availableGroups,
    ) {
        for (const group of candidateGroups) {
            const garden = group.gardens.find(predicate);
            if (garden) {
                return {
                    accountId: group.accountId,
                    garden,
                    isCurrent: group.isCurrent,
                };
            }
        }
        return null;
    }

    if (selectedGardenId !== null) {
        const selectedGarden = resolveExplicitGarden(groups, selectedGardenId);
        if (selectedGarden) {
            return selectedGarden;
        }
    }

    const defaultGarden = findGarden(
        (garden) => !garden.isSandbox && garden.isDefault === true,
    );
    if (defaultGarden) {
        return defaultGarden;
    }

    const currentGroups = groups.filter((group) => group.isCurrent);
    return (
        findGarden((garden) => !garden.isSandbox, currentGroups) ??
        findGarden((garden) => !garden.isSandbox) ??
        findGarden(() => true, currentGroups) ??
        findGarden(() => true)
    );
}

export function resolveCurrentAccountGardenId<
    TAccountGarden extends GardenSelectionCandidate,
    TCurrentGarden extends GardenSelectionCandidate,
>({
    accountGroups,
    currentAccountGardens,
    selectedGardenId,
}: {
    accountGroups:
        | readonly GardenSelectionGroup<TAccountGarden>[]
        | null
        | undefined;
    currentAccountGardens: readonly TCurrentGarden[] | null | undefined;
    selectedGardenId: number | null;
}) {
    const preferredGarden = resolvePreferredGarden(
        accountGroups,
        selectedGardenId,
    );
    if (preferredGarden?.isCurrent) {
        return preferredGarden.garden.id;
    }

    return (
        currentAccountGardens?.find((garden) => !garden.isSandbox)?.id ??
        currentAccountGardens?.[0]?.id ??
        null
    );
}
