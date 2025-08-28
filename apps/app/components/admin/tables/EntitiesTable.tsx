'use client';

import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Duplicate } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { cx } from '@signalco/ui-primitives/cx';
import { Row } from '@signalco/ui-primitives/Row';
import { Table } from '@signalco/ui-primitives/Table';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@signalco/ui-primitives/Tooltip';
import {
    Typography,
    Typography as UiTypography,
} from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { duplicateEntity } from '../../../app/(actions)/entityActions';
import { searchEntities } from '../../../app/(actions)/entitySearch';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';
import { ServerActionIconButton } from '../../shared/ServerActionIconButton';

interface EntityRow {
    id: number;
    displayName: string;
    progress: number;
    missingRequiredAttributes: string[];
    state: string;
    updatedAt: string;
}

export function EntitiesTable({
    entityTypeName,
    search = '',
}: {
    entityTypeName: string;
    search?: string;
}) {
    const [entities, setEntities] = useState<EntityRow[]>([]);
    const [, startTransition] = useTransition();

    useEffect(() => {
        const timeout = setTimeout(() => {
            startTransition(async () => {
                const data = await searchEntities(entityTypeName, search);
                setEntities(data);
            });
        }, 300);

        return () => clearTimeout(timeout);
    }, [entityTypeName, search]);

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naziv</Table.Head>
                    <Table.Head>Ispunjenost</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Zadnja izmjena</Table.Head>
                    <Table.Head></Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {!entities.length && (
                    <Table.Row>
                        <Table.Cell colSpan={4}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {entities.map((entity) => (
                    <Table.Row key={entity.id} className="group">
                        <Table.Cell>
                            <Link
                                href={KnownPages.DirectoryEntity(
                                    entityTypeName,
                                    entity.id,
                                )}
                            >
                                <Typography>{entity.displayName}</Typography>
                            </Link>
                        </Table.Cell>
                        <Table.Cell>
                            <div className="w-24">
                                <Tooltip delayDuration={250}>
                                    <TooltipTrigger asChild>
                                        <Row spacing={1}>
                                            <div className="h-1 bg-primary/10 rounded-full overflow-hidden grow">
                                                <div
                                                    className={cx(
                                                        'h-full',
                                                        entity.progress <= 99.99
                                                            ? 'bg-red-400'
                                                            : 'bg-green-500',
                                                    )}
                                                    style={{
                                                        width: `${entity.progress}%`,
                                                    }}
                                                />
                                            </div>
                                            <UiTypography level="body2">
                                                {entity.progress.toFixed(0)}%
                                            </UiTypography>
                                        </Row>
                                    </TooltipTrigger>
                                    <TooltipContent className="min-w-60">
                                        {entity.missingRequiredAttributes
                                            .length === 0 &&
                                            'Svi obavezni atributi su ispunjeni'}
                                        {entity.missingRequiredAttributes
                                            .length > 0 && (
                                            <div className="flex flex-col gap-1">
                                                <UiTypography semiBold>
                                                    Manjak obaveznih atributa:
                                                </UiTypography>
                                                <div className="flex flex-col">
                                                    {entity.missingRequiredAttributes
                                                        .slice(0, 5)
                                                        .map((a) => (
                                                            <UiTypography
                                                                key={a}
                                                            >
                                                                {a}
                                                            </UiTypography>
                                                        ))}
                                                    {entity
                                                        .missingRequiredAttributes
                                                        .length > 5 && (
                                                        <UiTypography secondary>
                                                            i{' '}
                                                            {entity
                                                                .missingRequiredAttributes
                                                                .length -
                                                                5}{' '}
                                                            drugih...
                                                        </UiTypography>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </Table.Cell>
                        <Table.Cell>
                            <div className="flex">
                                <Chip
                                    color={
                                        entity.state === 'draft'
                                            ? 'neutral'
                                            : 'success'
                                    }
                                >
                                    {entity.state === 'draft'
                                        ? 'U izradi'
                                        : 'Objavljeno'}
                                </Chip>
                            </div>
                        </Table.Cell>
                        <Table.Cell>
                            <Typography secondary>
                                <LocalDateTime time={false}>
                                    {entity.updatedAt}
                                </LocalDateTime>
                            </Typography>
                        </Table.Cell>
                        <Table.Cell>
                            <ServerActionIconButton
                                variant="plain"
                                title="Dupliciraj zapis"
                                className="group-hover:opacity-100 opacity-0 transition-opacity"
                                onClick={duplicateEntity.bind(
                                    null,
                                    entityTypeName,
                                    entity.id,
                                )}
                            >
                                <Duplicate className="size-5" />
                            </ServerActionIconButton>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
