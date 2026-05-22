'use client';

import type { OperationData } from '@gredice/client';
import type { PlantStageName } from '@gredice/game';
import { slug } from '@gredice/js/slug';
import { Accordion } from '@gredice/ui/Accordion';
import { Chip } from '@gredice/ui/Chip';
import {
    Droplet,
    Leaf,
    Sprout,
    Store,
    Tally3,
    Upload,
} from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { ShovelIcon } from '@gredice/ui/ShovelIcon';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { useMemo } from 'react';
import { NoDataPlaceholder } from '../../components/shared/placeholders/NoDataPlaceholder';
import { useClientSearchParam } from '../../hooks/useClientSearchParam';
import { OperationCard } from './OperationCard';
import {
    compareOperationsByStageAndLabel,
    getAvailableOperationStages,
    operationMatchesSearch,
} from './operationFilters';

const stageIcons: Record<
    PlantStageName,
    React.ComponentType<{ className?: string }>
> = {
    soilPreparation: () => <Tally3 className="size-4 rotate-90 mt-1" />,
    sowing: Sprout,
    planting: ShovelIcon,
    growth: Leaf,
    maintenance: Leaf,
    watering: Droplet,
    flowering: Leaf,
    harvest: Upload,
    storage: Store,
};

export function OperationsList({
    operationsData,
    initialSearch,
}: {
    operationsData: OperationData[];
    initialSearch: string;
}) {
    const [search] = useClientSearchParam('pretraga', initialSearch);
    const {
        availableStages,
        internalOperations,
        publicOperations,
        stageOperations,
    } = useMemo(() => {
        const filteredOperations = operationsData.filter((operation) =>
            operationMatchesSearch(operation, search),
        );
        const publicOperations = filteredOperations.filter(
            (operation) => operation.attributes.internal !== true,
        );
        const internalOperations = filteredOperations
            .filter((operation) => operation.attributes.internal === true)
            .sort(compareOperationsByStageAndLabel);
        const availableStages = getAvailableOperationStages(publicOperations);
        const stageOperations = new Map<
            PlantStageName,
            typeof publicOperations
        >();

        for (const stage of availableStages) {
            stageOperations.set(
                stage.name,
                publicOperations
                    .filter(
                        (operation) =>
                            operation.attributes.stage?.information?.name ===
                            stage.name,
                    )
                    .sort((left, right) =>
                        left.information.label.localeCompare(
                            right.information.label,
                        ),
                    ),
            );
        }

        return {
            availableStages,
            internalOperations,
            publicOperations,
            stageOperations,
        };
    }, [operationsData, search]);

    return (
        <>
            {availableStages.length > 0 && (
                <Stack spacing={2}>
                    <Typography level="body3">Kategorije</Typography>
                    <Row spacing={2} className="flex-wrap">
                        {availableStages.map((stage) => {
                            const Icon = stageIcons[stage.name];
                            return (
                                <Chip
                                    key={stage.name}
                                    color="neutral"
                                    href={`#${slug(stage.label)}`}
                                    startDecorator={<Icon className="size-4" />}
                                >
                                    {stage.label}
                                </Chip>
                            );
                        })}
                    </Row>
                </Stack>
            )}
            <Stack spacing={12}>
                {!publicOperations.length && !internalOperations.length && (
                    <div className="border rounded py-4">
                        <NoDataPlaceholder>
                            Nema dostupnih radnji.
                        </NoDataPlaceholder>
                    </div>
                )}
                {availableStages.map((stage) => {
                    const operationsForStage =
                        stageOperations.get(stage.name) ?? [];
                    const Icon = stageIcons[stage.name];
                    return (
                        <Stack
                            key={stage.name}
                            spacing={4}
                            id={slug(stage.label)}
                            className="scroll-mt-24"
                        >
                            <Row spacing={4}>
                                <Icon className="size-5 shrink-0" />
                                <Typography level="h5" component="h2">
                                    {stage.label}
                                </Typography>
                            </Row>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {operationsForStage.map((operation) => (
                                    <OperationCard
                                        key={operation.id}
                                        operation={operation}
                                    />
                                ))}
                            </div>
                        </Stack>
                    );
                })}
                {internalOperations.length > 0 && (
                    <Accordion className="h-min border-tertiary border-b-4">
                        <Row spacing={4} className="px-3">
                            <Store className="size-5 shrink-0" />
                            <Typography level="h5" component="h2">
                                Za OPG partnere
                            </Typography>
                        </Row>
                        <div className="px-3 pb-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {internalOperations.map((operation) => (
                                    <OperationCard
                                        key={operation.id}
                                        operation={operation}
                                    />
                                ))}
                            </div>
                        </div>
                    </Accordion>
                )}
            </Stack>
        </>
    );
}
