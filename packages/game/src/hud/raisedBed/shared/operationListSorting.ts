type SortableOperation = {
    id: number;
    information: {
        label: string;
    };
};

export function sortOperationsForList<T extends SortableOperation>(
    operations: readonly T[],
    shoppingCartOperationIds: ReadonlySet<number>,
    favoriteOperationIds: ReadonlySet<number>,
) {
    return [...operations].sort((left, right) => {
        const cartRank =
            Number(shoppingCartOperationIds.has(right.id)) -
            Number(shoppingCartOperationIds.has(left.id));
        if (cartRank !== 0) {
            return cartRank;
        }

        const favoriteRank =
            Number(favoriteOperationIds.has(right.id)) -
            Number(favoriteOperationIds.has(left.id));
        if (favoriteRank !== 0) {
            return favoriteRank;
        }

        const labelOrder = left.information.label.localeCompare(
            right.information.label,
            'hr-HR',
        );
        return labelOrder !== 0 ? labelOrder : left.id - right.id;
    });
}
