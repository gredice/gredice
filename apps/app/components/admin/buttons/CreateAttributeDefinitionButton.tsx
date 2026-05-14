'use client';

import { Add } from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Input } from '@signalco/ui-primitives/Input';
import { Modal } from '@signalco/ui-primitives/Modal';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { upsertAttributeDefinition } from '../../../app/(actions)/definitionActions';
import {
    attributeDataTypeItems,
    buildRangeDataType,
} from '../../../app/admin/directories/[entityType]/attribute-definitions/AttributeDataTypes';
import { KnownPages } from '../../../src/KnownPages';

export function CreateAttributeDefinitionButton({
    entityTypeName,
    categoryName,
}: {
    entityTypeName: string;
    categoryName: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [label, setLabel] = useState('');
    const [selectedDataType, setSelectedDataType] = useState<string>(
        attributeDataTypeItems[0].value,
    );
    const [rangeMinValue, setRangeMinValue] = useState('0');
    const [rangeMaxValue, setRangeMaxValue] = useState('100');
    const [submitting, setSubmitting] = useState(false);

    function resetForm() {
        setName('');
        setLabel('');
        setSelectedDataType(attributeDataTypeItems[0].value);
        setRangeMinValue('0');
        setRangeMaxValue('100');
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;
        const dataType =
            selectedDataType === 'range'
                ? buildRangeDataType(rangeMinValue, rangeMaxValue)
                : selectedDataType;
        setSubmitting(true);
        try {
            const { id } = await upsertAttributeDefinition({
                name,
                label,
                dataType,
                entityTypeName,
                category: categoryName,
            });
            setOpen(false);
            resetForm();
            router.push(
                KnownPages.DirectoryEntityTypeAttributeDefinition(
                    entityTypeName,
                    id,
                ),
            );
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) {
                    resetForm();
                }
            }}
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
                <form onSubmit={handleSubmit}>
                    <Stack spacing={4}>
                        <Stack spacing={1}>
                            <Input
                                name="name"
                                label="Naziv"
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                            />
                            <Input
                                name="label"
                                label="Labela"
                                value={label}
                                onChange={(event) =>
                                    setLabel(event.target.value)
                                }
                            />
                            <SelectItems
                                name="dataType"
                                label="Vrsta podatka"
                                value={selectedDataType}
                                items={attributeDataTypeItems}
                                onValueChange={setSelectedDataType}
                            />
                            {selectedDataType === 'range' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        type="number"
                                        name="rangeMin"
                                        label="Minimalna vrijednost"
                                        value={rangeMinValue}
                                        onChange={(event) =>
                                            setRangeMinValue(event.target.value)
                                        }
                                    />
                                    <Input
                                        type="number"
                                        name="rangeMax"
                                        label="Maksimalna vrijednost"
                                        value={rangeMaxValue}
                                        onChange={(event) =>
                                            setRangeMaxValue(event.target.value)
                                        }
                                    />
                                </div>
                            )}
                        </Stack>
                        <Button
                            variant="solid"
                            type="submit"
                            loading={submitting}
                            disabled={submitting}
                        >
                            Kreiraj
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </Modal>
    );
}
