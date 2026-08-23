import { Button } from '@gredice/ui/Button';
import { Input } from '@gredice/ui/Input';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    type BillingPreviewSearchState,
    billingPreviewSampleOptions,
} from '../billingPreviewModel';

const selectClassName =
    'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2';

export function BillingPreviewControls({
    state,
}: {
    state: BillingPreviewSearchState;
}) {
    return (
        <form action="/admin/billing/previews" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Stack spacing={1}>
                    <label
                        className="text-sm font-medium"
                        htmlFor="documentType"
                    >
                        Dokument
                    </label>
                    <select
                        className={selectClassName}
                        defaultValue={state.documentKind}
                        id="documentType"
                        name="documentType"
                    >
                        <option value="invoice">Ponuda</option>
                        <option value="receipt">Fiskalni račun</option>
                    </select>
                </Stack>
                <Stack spacing={1}>
                    <label className="text-sm font-medium" htmlFor="source">
                        Izvor
                    </label>
                    <select
                        className={selectClassName}
                        defaultValue={state.source}
                        id="source"
                        name="source"
                    >
                        <option value="sample">Primjer</option>
                        <option value="invoice">Postojeća ponuda</option>
                        <option value="receipt">
                            Postojeći fiskalni račun
                        </option>
                    </select>
                </Stack>
                <Stack spacing={1}>
                    <label className="text-sm font-medium" htmlFor="sampleId">
                        Primjer
                    </label>
                    <select
                        className={selectClassName}
                        defaultValue={state.sampleId}
                        id="sampleId"
                        name="sampleId"
                    >
                        {billingPreviewSampleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </Stack>
                <Stack spacing={1}>
                    <label className="text-sm font-medium" htmlFor="width">
                        Širina
                    </label>
                    <select
                        className={selectClassName}
                        defaultValue={state.width}
                        id="width"
                        name="width"
                    >
                        <option value="compact">Usko</option>
                        <option value="document">Dokument</option>
                        <option value="wide">Široko</option>
                    </select>
                </Stack>
                <Row className="items-end">
                    <Button type="submit" fullWidth>
                        Osvježi pregled
                    </Button>
                </Row>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Input
                    defaultValue={state.invoiceId}
                    fullWidth
                    helperText="Koristi se kad je izvor postojeća ponuda."
                    inputMode="numeric"
                    label="ID ponude"
                    name="invoiceId"
                    pattern="[0-9]*"
                />
                <Input
                    defaultValue={state.receiptId}
                    fullWidth
                    helperText="Koristi se kad je izvor postojeći fiskalni račun."
                    inputMode="numeric"
                    label="ID fiskalnog računa"
                    name="receiptId"
                    pattern="[0-9]*"
                />
            </div>
            <Typography level="body3" className="text-muted-foreground">
                Pregled ne izdaje, ne šalje, ne fiskalizira i ne pohranjuje
                završni dokument.
            </Typography>
        </form>
    );
}
