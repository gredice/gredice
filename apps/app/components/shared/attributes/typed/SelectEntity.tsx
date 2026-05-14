import { ExternalLink } from '@signalco/ui-icons';
import { Chip } from '@signalco/ui-primitives/Chip';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KnownPages } from '../../../../src/KnownPages';
import type { AttributeInputProps } from '../AttributeInputProps';
import { getRefEntities } from '../actions/entitiesActions';

export function SelectEntity({
    value,
    onChange,
    attributeDefinition,
}: AttributeInputProps) {
    const entityTypeName = attributeDefinition?.dataType.split(':')[1];
    const [entities, setEntities] =
        useState<Awaited<ReturnType<typeof getRefEntities>>>();

    useEffect(() => {
        if (!entityTypeName) {
            return;
        }

        getRefEntities(entityTypeName)
            .then((response) => {
                setEntities(response);
            })
            .catch((error) => {
                console.error('Error fetching entities:', error);
            });
    }, [entityTypeName]);

    const items = [
        { value: '-', label: '-' },
        ...(entities?.map((entity) => ({
            value: entity.id.toString(),
            label:
                entity.state === 'draft'
                    ? `${entity.label} (Draft)`
                    : entity.label,
        })) ?? []),
    ];

    const selectedEntity = useMemo(() => {
        if (!value || value === '-') {
            return null;
        }

        return (
            entities?.find((entity) => entity.id.toString() === value) ?? null
        );
    }, [entities, value]);

    const handleOnChange = (newValue: string) => {
        onChange(newValue !== '-' ? newValue : null);
    };

    return (
        <div className="flex items-center gap-2">
            <div className="flex-1">
                <SelectItems
                    items={items}
                    value={selectedEntity?.id.toString() ?? '-'}
                    onValueChange={handleOnChange}
                />
            </div>
            {selectedEntity?.state === 'draft' ? (
                <Chip color="neutral" className="w-fit">
                    Draft
                </Chip>
            ) : null}
            {entityTypeName && selectedEntity && (
                <Link
                    href={KnownPages.DirectoryEntity(
                        entityTypeName,
                        selectedEntity.id,
                    )}
                    title="Otvori detalje povezanog zapisa"
                    aria-label="Otvori detalje povezanog zapisa"
                    className="inline-flex text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ExternalLink className="size-4" />
                </Link>
            )}
        </div>
    );
}
