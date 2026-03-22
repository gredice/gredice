'use client';

import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useState } from 'react';
import { upsertAttributeDefinition } from '../../../../(actions)/definitionActions';
import { attributeDataTypeItems } from './AttributeDataTypes';

export function CreateAttributeDefinitionButton({
    entityTypeName,
    categoryName,
}: {
    entityTypeName: string;
    categoryName: string;
}) {
    const [dataType, setDataType] = useState<
        (typeof attributeDataTypeItems)[number]['value']
    >(attributeDataTypeItems[0].value);

    async function submitForm(formData: FormData) {
        const name = formData.get('name') as string;
        const label = formData.get('label') as string;
        const defaultValue = formData.get('defaultValue') as string;

        await upsertAttributeDefinition({
            name,
            label,
            dataType,
            defaultValue: defaultValue.length > 0 ? defaultValue : null,
            entityTypeName,
            category: categoryName,
        });
    }

    return (
        <Modal
            trigger={
                <IconButton variant="plain" title="Dodaj atribut">
                    <Add className="size-5" />
                </IconButton>
            }
            title="Nova definicija"
        >
            <Stack spacing={2}>
                <Stack spacing={1}>
                    <Typography level="h5">Novi atribut</Typography>
                    <Typography level="body2">
                        Unesite podatke za novi atribut.
                    </Typography>
                </Stack>
                <form action={submitForm}>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Input name="name" label="Naziv" />
                            <Input name="label" label="Labela" />
                            <input
                                type="hidden"
                                name="dataType"
                                value={dataType}
                            />
                            <Stack spacing={0.5}>
                                <Typography level="body2">
                                    Vrsta podatka
                                </Typography>
                                <SelectItems
                                    value={dataType}
                                    onValueChange={(value) =>
                                        setDataType(
                                            value as (typeof attributeDataTypeItems)[number]['value'],
                                        )
                                    }
                                    items={attributeDataTypeItems}
                                />
                            </Stack>
                            <Input
                                name="defaultValue"
                                label="Zadana vrijednost"
                                placeholder="-"
                            />
                        </Stack>
                        <Button variant="solid" type="submit">
                            Kreiraj
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}
