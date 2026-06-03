import { Chip } from '@gredice/ui/Chip';
import { ExternalLink } from '@gredice/ui/icons';
import { SelectItems } from '@gredice/ui/SelectItems';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KnownPages } from '../../../../src/KnownPages';
import type { AttributeInputProps } from '../AttributeInputProps';
import { getRefEntities } from '../actions/entitiesActions';

export function SelectEntity({
    blockedValues = [],
    entityId,
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

    const isPlantRelationship =
        attributeDefinition?.entityTypeName === 'plant' &&
        attributeDefinition.category === 'relationships' &&
        attributeDefinition.dataType === 'ref:plant' &&
        (attributeDefinition.name === 'companions' ||
            attributeDefinition.name === 'antagonists');
    const blockedValueSet = useMemo(
        () => new Set(blockedValues),
        [blockedValues],
    );
    const selectableEntities = useMemo(() => {
        if (!entities) {
            return [];
        }

        if (!isPlantRelationship) {
            return entities;
        }

        return entities.filter((entity) => {
            const entityValue = entity.id.toString();
            if (entity.id === entityId) {
                return false;
            }
            return entityValue === value || !blockedValueSet.has(entityValue);
        });
    }, [blockedValueSet, entities, entityId, isPlantRelationship, value]);

    const items = [
        { value: '-', label: '-' },
        ...selectableEntities.map((entity) => ({
            value: entity.id.toString(),
            label:
                entity.state === 'draft'
                    ? `${entity.label} (Draft)`
                    : entity.label,
        })),
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
        <div className="flex w-full max-w-xl items-center gap-2">
            <div className="min-w-0 flex-1">
                <SelectItems
                    className="min-w-0"
                    items={items}
                    value={selectedEntity?.id.toString() ?? '-'}
                    onValueChange={handleOnChange}
                />
            </div>
            {selectedEntity?.state === 'draft' ? (
                <Chip color="neutral">Draft</Chip>
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
