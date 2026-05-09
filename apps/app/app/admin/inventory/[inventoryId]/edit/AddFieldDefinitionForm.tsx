'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { useMemo, useState } from 'react';

export function AddFieldDefinitionForm({
    onSubmit,
    hasStatusField,
    hasAmountField,
}: {
    onSubmit: (formData: FormData) => Promise<void>;
    hasStatusField: boolean;
    hasAmountField: boolean;
}) {
    const [selectedDataType, setSelectedDataType] = useState('text');
    const showSelectOptions = selectedDataType === 'select';
    const statusSelectOptions = useMemo(
        () => ['new|Novo', 'opened|Otvoreno', 'used|Korišteno'].join('\n'),
        [],
    );

    return (
        <Card className="max-w-2xl">
            <Stack spacing={4} className="p-6">
                <Typography level="body1" semiBold>
                    Dodaj novo polje
                </Typography>
                <Stack spacing={1}>
                    <Typography level="body2" secondary>
                        Brze akcije za najčešća polja:
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <form action={onSubmit}>
                            <input type="hidden" name="name" value="status" />
                            <input type="hidden" name="label" value="Status" />
                            <input
                                type="hidden"
                                name="dataType"
                                value="select"
                            />
                            <input
                                type="hidden"
                                name="selectOptions"
                                value={statusSelectOptions}
                            />
                            <input
                                type="hidden"
                                name="required"
                                value="false"
                            />
                            <Button
                                type="submit"
                                variant="outlined"
                                disabled={hasStatusField}
                                className="w-fit"
                            >
                                Dodaj status atribut
                            </Button>
                        </form>
                        <form action={onSubmit}>
                            <input type="hidden" name="name" value="amount" />
                            <input
                                type="hidden"
                                name="label"
                                value="Količina"
                            />
                            <input
                                type="hidden"
                                name="dataType"
                                value="number"
                            />
                            <input
                                type="hidden"
                                name="required"
                                value="false"
                            />
                            <Button
                                type="submit"
                                variant="outlined"
                                disabled={hasAmountField}
                                className="w-fit"
                            >
                                Dodaj amount atribut
                            </Button>
                        </form>
                    </Stack>
                </Stack>
                <form action={onSubmit}>
                    <Stack spacing={3}>
                        <Input
                            name="name"
                            label="Naziv polja"
                            placeholder="npr. expiryDate"
                            required
                        />
                        <Input
                            name="label"
                            label="Labela"
                            placeholder="npr. Rok trajanja"
                            required
                        />
                        <SelectItems
                            name="dataType"
                            label="Tip podatka"
                            items={[
                                { value: 'text', label: 'Tekst' },
                                { value: 'number', label: 'Broj' },
                                { value: 'date', label: 'Datum' },
                                { value: 'boolean', label: 'Da/Ne' },
                                { value: 'select', label: 'Odabir (select)' },
                            ]}
                            defaultValue="text"
                            onValueChange={setSelectedDataType}
                        />
                        {showSelectOptions && (
                            <label className="flex flex-col gap-1">
                                <Typography level="body2" semiBold>
                                    Select opcije
                                </Typography>
                                <textarea
                                    name="selectOptions"
                                    required
                                    rows={4}
                                    placeholder={'new|Novo\nopened|Otvoreno'}
                                    className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
                                />
                                <Typography level="body3" secondary>
                                    Jedna opcija po retku u formatu{' '}
                                    <code>value|label</code>. Ako ne navedete
                                    label, koristi se value.
                                </Typography>
                            </label>
                        )}
                        <SelectItems
                            name="required"
                            label="Obavezno"
                            items={[
                                { value: 'false', label: 'Ne' },
                                { value: 'true', label: 'Da' },
                            ]}
                            defaultValue="false"
                        />
                        <Button variant="solid" type="submit" className="w-fit">
                            Dodaj polje
                        </Button>
                    </Stack>
                </form>
            </Stack>
        </Card>
    );
}
