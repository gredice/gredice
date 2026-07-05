import { Chip } from '@gredice/ui/Chip';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { BillingDocumentPreviewModel } from '../billingPreviewModel';

function FieldRows({
    fields,
}: {
    fields: BillingDocumentPreviewModel['seller'];
}) {
    if (fields.length === 0) {
        return (
            <Typography level="body2" className="text-muted-foreground">
                Nema podataka.
            </Typography>
        );
    }

    return (
        <dl className="grid gap-2 text-sm">
            {fields.map((field) => (
                <div
                    className="grid gap-1 sm:grid-cols-[9rem_minmax(0,1fr)]"
                    key={`${field.label}-${field.value}`}
                >
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd
                        className={
                            field.mono
                                ? 'break-words font-mono text-xs'
                                : 'break-words'
                        }
                    >
                        {field.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function DocumentSection({
    children,
    title,
}: {
    children: React.ReactNode;
    title: string;
}) {
    return (
        <section className="space-y-3">
            <Typography
                component="h2"
                level="body1"
                semiBold
                className="border-b pb-2"
            >
                {title}
            </Typography>
            {children}
        </section>
    );
}

export function BillingDocumentPreview({
    model,
}: {
    model: BillingDocumentPreviewModel;
}) {
    return (
        <article className="billing-preview-print overflow-hidden rounded-md border bg-background shadow-sm">
            <div className="space-y-8 p-5 sm:p-8">
                <header className="grid gap-6 border-b pb-6 md:grid-cols-[1fr_auto]">
                    <Stack spacing={2}>
                        <Typography
                            component="p"
                            level="body2"
                            className="uppercase tracking-wide text-muted-foreground"
                        >
                            Gredice
                        </Typography>
                        <Typography component="h1" level="h2">
                            {model.documentLabel}
                        </Typography>
                        <Typography className="font-mono text-sm">
                            {model.number}
                        </Typography>
                    </Stack>
                    <div className="space-y-2 md:text-right">
                        <Chip color={model.statusTone}>
                            {model.statusLabel}
                        </Chip>
                        <Typography level="body2">
                            Izdano: {model.issuedAt}
                        </Typography>
                        {model.dueAt ? (
                            <Typography level="body2">
                                Dospijeće: {model.dueAt}
                            </Typography>
                        ) : null}
                        {model.paidAt ? (
                            <Typography level="body2">
                                Plaćeno: {model.paidAt}
                            </Typography>
                        ) : null}
                    </div>
                </header>

                <div className="grid gap-6 lg:grid-cols-2">
                    <DocumentSection title="Izdavatelj">
                        <FieldRows fields={model.seller} />
                    </DocumentSection>
                    <DocumentSection title="Kupac">
                        <FieldRows fields={model.customer} />
                    </DocumentSection>
                </div>

                <DocumentSection title="Stavke">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] table-fixed text-sm">
                            <thead>
                                <tr className="border-b text-left text-muted-foreground">
                                    <th className="w-[44%] py-2 pr-4 font-medium">
                                        Opis
                                    </th>
                                    <th className="w-[14%] px-2 py-2 text-right font-medium">
                                        Količina
                                    </th>
                                    <th className="w-[20%] px-2 py-2 text-right font-medium">
                                        Cijena
                                    </th>
                                    <th className="w-[22%] py-2 pl-2 text-right font-medium">
                                        Ukupno
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {model.lineItems.map((item) => (
                                    <tr
                                        className="border-b align-top last:border-0"
                                        key={`${item.description}-${item.totalPrice}`}
                                    >
                                        <td className="break-words py-3 pr-4">
                                            <span>{item.description}</span>
                                            {item.reference ? (
                                                <span className="mt-1 block font-mono text-xs text-muted-foreground">
                                                    {item.reference}
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="px-2 py-3 text-right">
                                            {item.quantity}
                                        </td>
                                        <td className="px-2 py-3 text-right">
                                            {item.unitPrice}
                                        </td>
                                        <td className="py-3 pl-2 text-right font-medium">
                                            {item.totalPrice}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DocumentSection>

                <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
                    <Stack spacing={6}>
                        <DocumentSection title="Plaćanje">
                            <FieldRows fields={model.payment} />
                        </DocumentSection>
                        {model.fiscalization.length > 0 ? (
                            <DocumentSection title="Fiskalizacija">
                                <FieldRows fields={model.fiscalization} />
                            </DocumentSection>
                        ) : null}
                    </Stack>
                    <section className="space-y-3 rounded-md border bg-muted/20 p-4">
                        <div className="flex justify-between gap-4">
                            <Typography level="body2">Osnovica</Typography>
                            <Typography className="text-right">
                                {model.subtotal}
                            </Typography>
                        </div>
                        <div className="flex justify-between gap-4">
                            <Typography level="body2">PDV</Typography>
                            <Typography className="text-right">
                                {model.taxAmount}
                            </Typography>
                        </div>
                        <div className="flex justify-between gap-4 border-t pt-3">
                            <Typography semiBold>Ukupno</Typography>
                            <Typography
                                level="h4"
                                semiBold
                                className="text-right"
                            >
                                {model.totalAmount}
                            </Typography>
                        </div>
                    </section>
                </div>

                {model.notes || model.terms ? (
                    <DocumentSection title="Napomene">
                        {model.notes ? (
                            <Typography level="body2">{model.notes}</Typography>
                        ) : null}
                        {model.terms ? (
                            <Typography level="body2">{model.terms}</Typography>
                        ) : null}
                    </DocumentSection>
                ) : null}
            </div>
        </article>
    );
}
