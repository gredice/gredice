'use client';

import { SelectAttributeDefinition, SelectAttributeValue } from '@gredice/storage';
import { Input } from '@signalco/ui-primitives/Input';
import { useState } from 'react';
import { Add, Delete } from '@signalco/ui-icons';
import { Minus } from 'lucide-react';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Checkbox } from '@signalco/ui-primitives/Checkbox';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';
import { Row } from '@signalco/ui-primitives/Row';
import '@mdxeditor/editor/style.css'
import dynamic from 'next/dynamic';
import { Button } from '@signalco/ui-primitives/Button';
import { Stack } from '@signalco/ui-primitives/Stack';
import { camelToSentenceCase } from '@signalco/js';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Card } from '@signalco/ui-primitives/Card';

const MarkdownInput = dynamic(() => import('./MarkdownInput').then(mod => mod.MarkdownInput), {
    ssr: false,
    loading: () => <Skeleton className='w-full h-40' />
});

export type AttributeInputProps = {
    value: string | null | undefined,
    onChange: (value: string | null) => void,
    schema?: Schema | string | null
};

function TextInput({ value, onChange }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || '');
    const handleOnChange = (newValue: string) => {
        setInputValue(newValue);
    }
    const handleOnBlur = () => {
        onChange(inputValue || null);
    }
    return (
        <Input
            placeholder={"Nema informacija..."}
            value={inputValue}
            onChange={(e) => handleOnChange(e.target.value)}
            onBlur={handleOnBlur}
            fullWidth />
    );
}

function BooleanInput({ value, onChange }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || 'false');
    const handleOnCheckedChange = (checked: boolean) => {
        setInputValue(checked ? 'true' : 'false');
        onChange(checked ? 'true' : 'false');
    }

    return (
        <Checkbox
            checked={inputValue === 'true'}
            onCheckedChange={handleOnCheckedChange}
        />
    )
}

function NumberInput({ value, onChange }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<string>(value || '');

    const handleIncrementDecrement = (inc: boolean) => {
        // Increment or decrement the value by least significant digit
        // eg. if value is 1, incrementing will make it 2
        // if value is 1.1, incrementing will make it 1.2
        // if value is 1.01, incrementing will make it 1.02
        let newValue = parseFloat(inputValue || '0');
        const leastSignificantDigit = inputValue.indexOf('.') !== -1
            ? Math.pow(0.1, inputValue.split('.')[1].length)
            : 1;
        newValue = inc ? newValue + leastSignificantDigit : newValue - leastSignificantDigit;

        setInputValue(newValue.toString());
        onChange(newValue.toString());
    }

    return (
        <Row className='items-stretch'>
            <Button
                className='rounded-r-none h-auto border-r-0'
                variant='outlined'
                type='button'
                onClick={() => handleIncrementDecrement(false)}>
                <Minus className='size-4' />
            </Button>
            <Input
                className='w-20 rounded-none'
                placeholder={"NA"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={() => onChange(inputValue || null)} />
            <Button
                className='rounded-l-none h-auto border-l-0'
                variant='outlined'
                onClick={() => handleIncrementDecrement(true)}>
                <Add className='size-4' />
            </Button>
        </Row>
    )
}

type Schema = { [key: string]: string | Schema };

/**
 * Unwraps the schema string to schema object model.
 * 
 * Format:
 *   key1:type,key2:type,...
 *   key is name of the property
 *   type is one of: string | number | boolean | schema
 *   when type is schema it is wrapped in {} like 'key1:{subkey1:string,subkey2:{subsubkey1:string}}
 * @param schema The schema string
 * @returns The unwrapped schema model.
 */
function unwrapSchema(schema: string): Schema {
    const result: Schema = {};
    let depth = 0;
    let currentPair = '';

    for (let i = 0; i < schema.length; i++) {
        const char = schema[i];

        if (char === ',' && depth === 0) {
            processPair(currentPair);
            currentPair = '';
        } else {
            if (char === '{') depth++;
            if (char === '}') depth--;
            currentPair += char;
        }
    }

    if (currentPair) {
        processPair(currentPair);
    }

    function processPair(pair: string) {
        const [key, type] = pair.split(/:(.+)/); // Split only at the first colon
        if (type.startsWith('{') && type.endsWith('}')) {
            result[key] = unwrapSchema(type.slice(1, -1));
        } else {
            result[key] = type;
        }
    }

    return result;
}

function JsonInput({ value, onChange, schema }: AttributeInputProps) {
    const [inputValue, setInputValue] = useState<Record<string, unknown>>(JSON.parse(value ?? '{}'));

    const handleOnChange = (newValue: Record<string, unknown>) => {
        setInputValue(newValue);
        onChange(JSON.stringify(newValue));
    }

    const schemaUnwrapped = typeof schema === 'string' ? unwrapSchema(schema ?? '') : (schema ?? {});

    return (
        <Card>
            <Stack spacing={1}>
                {Object.keys(schemaUnwrapped).map((key) => {
                    let InputComponent: any = TextInput;
                    let inputSchema: Schema | null = null;
                    if (schemaUnwrapped[key] === 'string') {
                        InputComponent = TextInput;
                    } else if (schemaUnwrapped[key] === 'number') {
                        InputComponent = NumberInput;
                    } else if (schemaUnwrapped[key] === 'boolean') {
                        InputComponent = BooleanInput;
                    } else if (schemaUnwrapped[key] === 'markdown') {
                        InputComponent = MarkdownInput;
                    } else if (typeof schemaUnwrapped[key] === 'object') {
                        InputComponent = JsonInput;
                    } else {
                        return (
                            <Typography key={key} level='body2' className='bg-red-600 text-white rounded-md p-4'>
                                Type {typeof schemaUnwrapped[key]} not supported
                            </Typography>
                        )
                    }

                    return (
                        <Stack spacing={0.5} key={key}>
                            <Typography level='body2'>{camelToSentenceCase(key)}</Typography>
                            <InputComponent
                                value={typeof inputValue[key] === 'string'
                                    ? inputValue[key]
                                    : JSON.stringify(inputValue[key])}
                                onChange={(newValue: string | null) => {
                                    handleOnChange({ ...inputValue, [key]: newValue });
                                }}
                                schema={inputSchema}
                            />
                        </Stack>
                    );
                })}
            </Stack>
        </Card>
    );
}

export function AttributeInput({
    entityType,
    entityId,
    attributeDefinition,
    attributeValue,
    upsertAttributeValue,
    deleteAttributeValue
}: {
    entityType: string,
    entityId: number,
    attributeDefinition: SelectAttributeDefinition,
    attributeValue: SelectAttributeValue | undefined | null,
    upsertAttributeValue: (entityType: string, entityId: number, attributeDefinition: SelectAttributeDefinition, attributeValueId?: number, newValue?: string | null) => Promise<void>
    deleteAttributeValue: (attributeValue: SelectAttributeValue) => Promise<void>
}) {
    const handleValueChange = async (value: string | null) => {
        // Ignore if not changed
        if (value === attributeValue?.value ||
            (value === '' && !attributeValue?.value)) {
            return;
        }

        try {
            await upsertAttributeValue(entityType, entityId, attributeDefinition, attributeValue?.id, value);
        } catch {
            // TODO: Display error notification
        }
    }

    const handleValueDelete = async () => {
        if (!attributeValue) {
            return;
        }
        await deleteAttributeValue(attributeValue);
    }

    let AttributeInputComponent: any = TextInput;
    let schema: string | null = null;
    if (attributeDefinition.dataType === 'boolean') {
        AttributeInputComponent = BooleanInput;
    } else if (attributeDefinition.dataType === 'markdown') {
        AttributeInputComponent = MarkdownInput;
    } else if (attributeDefinition.dataType === 'number') {
        AttributeInputComponent = NumberInput;
    } else if (attributeDefinition.dataType.startsWith('json')) {
        AttributeInputComponent = JsonInput;
        // Extract schema from json|{schema} string
        schema = attributeDefinition.dataType.substring(5);
    }

    return (
        <div className='grid grid-cols-[1fr,auto] gap-1 items-center'>
            <AttributeInputComponent
                value={attributeValue?.value}
                onChange={handleValueChange}
                schema={schema}
            />
            {attributeValue && attributeDefinition.multiple && (
                <IconButton onClick={handleValueDelete} variant='plain'>
                    <Delete className='size-4' />
                </IconButton>
            )}
        </div>
    );
}