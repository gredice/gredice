'use client';

import { Button } from '@signalco/ui-primitives/Button';
import { Card } from '@signalco/ui-primitives/Card';
import { Input } from '@signalco/ui-primitives/Input';
import { SelectItems } from '@signalco/ui-primitives/SelectItems';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

export function AddFieldDefinitionForm({
    onSubmit,
}: {
    onSubmit: (formData: FormData) => Promise<void>;
}) {
    return (
        <Card className="max-w-2xl">
            <Stack spacing={4} className="p-6">
                <Typography level="body1" semiBold>
                    Dodaj novo polje
                </Typography>
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
                            ]}
                            defaultValue="text"
                        />
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
