'use client';

import { useState } from 'react';
import { Stack } from '@signalco/ui-primitives/Stack';
import { camelToSentenceCase } from '@signalco/js';
import { Typography } from '@signalco/ui-primitives/Typography';
import { Card } from '@signalco/ui-primitives/Card';
import { AttributeInputProps } from '../AttributeInputProps';
import { TextInput } from './TextInput';
import { BooleanInput } from './BooleanInput';
import { NumberInput } from './NumberInput';
import { AttributeInputSchema } from '../AttributeInputSchema';
import dynamic from 'next/dynamic';
import { Skeleton } from '@signalco/ui-primitives/Skeleton';

const MarkdownInput = dynamic(() => import('./MarkdownInput').then(mod => ({
    default: mod.MarkdownInput
})), {
    ssr: false,
    loading: () => <Skeleton className='w-full h-40' />
});

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
function unwrapSchema(schema: string): AttributeInputSchema {
    const result: AttributeInputSchema = {};
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

export function JsonInput({ value, onChange, schema }: AttributeInputProps) {
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
                    let inputSchema: AttributeInputSchema | null = null;
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
                            <Typography level='body2'>
                                {camelToSentenceCase(key)}
                            </Typography>
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
