'use client';

import { SelectAttributeDefinition, SelectAttributeValue } from '@gredice/storage';
import { Delete } from '@signalco/ui-icons';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import dynamic from 'next/dynamic';
import { TextInput } from './typed/TextInput';
import { BooleanInput } from './typed/BooleanInput';
import { NumberInput } from './typed/NumberInput';
import { JsonInput } from './typed/JsonInput';
import { handleValueSave, handleValueDelete } from '../../../app/(actions)/entityActions';
import { ComponentType } from 'react';
import { AttributeInputProps } from './AttributeInputProps';
import { SelectEntity } from './typed/SelectEntity';
import { BarcodeInput } from './typed/BarcodeInput';

const MarkdownInput = dynamic(() => import('./typed/MarkdownInput').then(mod => ({
    default: mod.MarkdownInput
})), {
    ssr: false,
    loading: () => <Skeleton className='w-full h-40' />
});

export function AttributeInput({
    entityType,
    entityId,
    attributeDefinition,
    attributeValue
}: {
    entityType: string,
    entityId: number,
    attributeDefinition: SelectAttributeDefinition,
    attributeValue: SelectAttributeValue | undefined | null
}) {
    const handleChange = async (value: string | null) => {
        // Ignore if not changed or empty/null value
        if (value === attributeValue?.value ||
            (value === '' && !attributeValue?.value)) {
            return;
        }

        try {
            await handleValueSave(entityType, entityId, attributeDefinition, attributeValue?.id, value);
        } catch {
            // TODO: Display error notification
        }
    }

    const handleDelete = async () => {
        if (!attributeValue) {
            return;
        }
        await handleValueDelete(attributeValue);
    }

    let AttributeInputComponent: ComponentType<AttributeInputProps> = TextInput;
    let schema: string | null = null;
    if (attributeDefinition.dataType.startsWith('ref:')) {
        AttributeInputComponent = SelectEntity;
    } else if (attributeDefinition.dataType === 'boolean') {
        AttributeInputComponent = BooleanInput;
    } else if (attributeDefinition.dataType === 'markdown') {
        AttributeInputComponent = MarkdownInput;
    } else if (attributeDefinition.dataType === 'number') {
        AttributeInputComponent = NumberInput;
    } else if (attributeDefinition.dataType === 'barcode') {
        AttributeInputComponent = BarcodeInput;
    } else if (attributeDefinition.dataType.startsWith('json')) {
        AttributeInputComponent = JsonInput;
        // Extract schema from json|{schema} string
        schema = attributeDefinition.dataType.substring(5);
    }

    return (
        <div className='grid grid-cols-[1fr,auto] gap-1 items-center'>
            <AttributeInputComponent
                attributeDefinition={attributeDefinition}
                value={attributeValue?.value}
                onChange={handleChange}
                schema={schema}
            />
            {attributeValue && attributeDefinition.multiple && (
                <IconButton onClick={handleDelete} variant='plain' title='Obriši'>
                    <Delete className='size-4' />
                </IconButton>
            )}
        </div>
    );
}