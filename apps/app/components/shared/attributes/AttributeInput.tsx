'use client';

import type {
    SelectAttributeDefinition,
    SelectAttributeValue,
} from '@gredice/storage';
import { IconButton } from '@gredice/ui/IconButton';
import { Delete, Remove } from '@gredice/ui/icons';
import { ModalConfirm } from '@gredice/ui/ModalConfirm';
import { Skeleton } from '@gredice/ui/Skeleton';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { useState } from 'react';
import {
    handleValueDelete,
    handleValueSave,
} from '../../../app/(actions)/entityActions';
import { useEntityDetailsSave } from '../../../app/admin/directories/[entityType]/[entityId]/EntityDetailsSaveContext';
import type { AttributeInputProps } from './AttributeInputProps';
import { BarcodeInput } from './typed/BarcodeInput';
import { BooleanInput } from './typed/BooleanInput';
import { ImageInput } from './typed/ImageInput';
import { JsonInput } from './typed/JsonInput';
import { NumberInput } from './typed/NumberInput';
import { RangeInput } from './typed/RangeInput';
import { SelectEntity } from './typed/SelectEntity';
import { TextInput } from './typed/TextInput';

const MarkdownInput = dynamic(
    () =>
        import('./typed/MarkdownInput').then((mod) => ({
            default: mod.MarkdownInput,
        })),
    {
        ssr: false,
        loading: () => <Skeleton className="w-full h-40" />,
    },
);

export function AttributeInput({
    blockedValues,
    entityType,
    entityId,
    attributeDefinition,
    attributeValue,
    presentation = 'default',
}: {
    blockedValues?: string[];
    entityType: string;
    entityId: number;
    attributeDefinition: SelectAttributeDefinition;
    attributeValue: SelectAttributeValue | undefined | null;
    presentation?: 'default' | 'list-item';
}) {
    const { trackSave } = useEntityDetailsSave();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleChange = async (value: string | null) => {
        console.debug(
            'AttributeInput handleChange',
            value,
            attributeValue?.entityTypeName,
            attributeValue?.entityId,
        );

        // Ignore if not changed or empty/null value
        if (
            value === attributeValue?.value ||
            (value === '' && !attributeValue?.value)
        ) {
            console.debug('AttributeInput handleChange: no change');
            return;
        }

        try {
            await trackSave(async () => {
                const result = await handleValueSave(
                    entityType,
                    entityId,
                    attributeDefinition,
                    attributeValue?.id,
                    value,
                );
                if (!result.success) {
                    throw new Error(result.message);
                }
            });
            setErrorMessage(null);
        } catch (error) {
            console.error('AttributeInput handleChange error', error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Vrijednost nije spremljena.',
            );
        }
    };

    const handleDelete = async () => {
        if (!attributeValue) {
            return;
        }

        try {
            await trackSave(() => handleValueDelete(attributeValue));
            setErrorMessage(null);
        } catch (error) {
            console.error('AttributeInput handleDelete error', error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Vrijednost nije obrisana.',
            );
        }
    };

    let AttributeInputComponent: ComponentType<AttributeInputProps> = TextInput;
    let schema: string | null = null;
    const isReferenceInput = attributeDefinition.dataType.startsWith('ref:');
    const isTextInput = attributeDefinition.dataType === 'text';
    const isComplexValueInput =
        attributeDefinition.dataType === 'markdown' ||
        attributeDefinition.dataType === 'image' ||
        attributeDefinition.dataType.startsWith('json');
    if (isReferenceInput) {
        AttributeInputComponent = SelectEntity;
    } else if (attributeDefinition.dataType === 'boolean') {
        AttributeInputComponent = BooleanInput;
    } else if (attributeDefinition.dataType === 'markdown') {
        AttributeInputComponent = MarkdownInput;
    } else if (attributeDefinition.dataType === 'number') {
        AttributeInputComponent = NumberInput;
    } else if (
        attributeDefinition.dataType === 'range' ||
        attributeDefinition.dataType.startsWith('range|')
    ) {
        AttributeInputComponent = RangeInput;
    } else if (attributeDefinition.dataType === 'barcode') {
        AttributeInputComponent = BarcodeInput;
    } else if (attributeDefinition.dataType === 'image') {
        AttributeInputComponent = ImageInput;
    } else if (attributeDefinition.dataType.startsWith('json')) {
        AttributeInputComponent = JsonInput;
        // Extract schema from json|{schema} string
        schema = attributeDefinition.dataType.substring(5);
    }

    const canDelete = Boolean(attributeValue && attributeDefinition.multiple);
    const shouldConfirmDelete = canDelete && isComplexValueInput;

    if (canDelete && isReferenceInput) {
        return (
            <div className="w-full max-w-xl">
                <div className="grid grid-cols-[minmax(0,1fr),auto] items-center gap-1">
                    <AttributeInputComponent
                        attributeDefinition={attributeDefinition}
                        blockedValues={blockedValues}
                        entityId={entityId}
                        value={attributeValue?.value}
                        onChange={handleChange}
                        schema={schema}
                        presentation={presentation}
                    />
                    <IconButton
                        className="shrink-0"
                        onClick={handleDelete}
                        variant="plain"
                        title="Ukloni"
                        type="button"
                        size="xs"
                    >
                        <Remove className="size-3.5" />
                    </IconButton>
                </div>
                {errorMessage ? (
                    <p className="mt-1 text-sm text-red-600" role="alert">
                        {errorMessage}
                    </p>
                ) : null}
            </div>
        );
    }

    return (
        <div className={isTextInput ? 'w-full max-w-xl' : undefined}>
            <div className="relative">
                <AttributeInputComponent
                    attributeDefinition={attributeDefinition}
                    blockedValues={blockedValues}
                    entityId={entityId}
                    value={attributeValue?.value}
                    onChange={handleChange}
                    schema={schema}
                    presentation={presentation}
                />
                {canDelete &&
                    (shouldConfirmDelete ? (
                        <ModalConfirm
                            title="Potvrdi brisanje"
                            header="Obrisati vrijednost atributa?"
                            onConfirm={handleDelete}
                            trigger={
                                <IconButton
                                    className="absolute right-0 top-0 z-10"
                                    variant="plain"
                                    title="Obriši"
                                    type="button"
                                    size="xs"
                                >
                                    <Delete className="size-3.5" />
                                </IconButton>
                            }
                        >
                            Ova vrijednost sadrži više podataka. Brisanje se ne
                            može poništiti.
                        </ModalConfirm>
                    ) : (
                        <IconButton
                            className="absolute right-0 top-0 z-10"
                            onClick={handleDelete}
                            variant="plain"
                            title="Obriši"
                            type="button"
                            size="xs"
                        >
                            <Delete className="size-3.5" />
                        </IconButton>
                    ))}
            </div>
            {errorMessage ? (
                <p className="mt-1 text-sm text-red-600" role="alert">
                    {errorMessage}
                </p>
            ) : null}
        </div>
    );
}
