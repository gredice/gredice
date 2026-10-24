'use client';

import { slug } from '@gredice/js/slug';
import { OperationCategoryIcon } from '@gredice/ui/OperationImage';
import { useMemo } from 'react';
import { PageSectionNav } from '../../components/shared/PageSectionNav';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import {
    getAvailableOperationStages,
    operationMatchesSearch,
} from './operationFilters';

export type OperationStagesNavOperation = {
    information: { label: string };
    attributes: { stage?: { information?: { name?: string } } };
};

export function OperationStagesNav({
    operations,
    initialSearch,
    className,
}: {
    operations: OperationStagesNavOperation[];
    initialSearch: string;
    className?: string;
}) {
    const [search] = useClientSearchParam('pretraga', initialSearch);
    const availableStages = useMemo(
        () =>
            getAvailableOperationStages(
                operations.filter((operation) =>
                    operationMatchesSearch(operation, search),
                ),
            ),
        [operations, search],
    );

    return (
        <PageSectionNav
            label="Kategorije radnji"
            items={availableStages.map((stage) => ({
                id: slug(stage.label),
                label: stage.label,
                icon: (
                    <OperationCategoryIcon
                        aria-hidden
                        variant="game"
                        categoryName={stage.name}
                        className="size-5"
                    />
                ),
            }))}
            className={className}
        />
    );
}
