import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Book, Hammer, Printer, Sprout } from '@gredice/ui/icons';
import { DropdownMenuItem } from '@gredice/ui/Menu';
import { SplitButton } from '@gredice/ui/SplitButton';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { DocumentationChangeTypeBadge } from './DocumentationChangeTypeBadge';
import { DocumentationSummaryCard } from './DocumentationSummaryCard';
import {
    discardedDocumentationPages,
    documentationPackageContentQueryValue,
    type FarmerDocumentationChangeType,
    type FarmerDocumentationPackageContent,
    formatDocumentationDateTime,
    getFarmerDocumentationPackage,
    includedDocumentationPages,
    parseDocumentationSince,
} from './farmerDocumentationData';

export const dynamic = 'force-dynamic';

type PackageRow = {
    code: string;
    label: string;
    documentTypeLabel: string;
    changeType: FarmerDocumentationChangeType;
    changedAt: Date | null;
    detail: string;
};

export default async function FarmerDocumentationPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);

    const params = await searchParams;
    const sinceInput = singleSearchParam(params.since);
    const since = parseDocumentationSince(sinceInput);
    const documentationPackage = await getFarmerDocumentationPackage({
        since,
    });
    const packageRows = packageTableRows(documentationPackage);
    const changesHref = printoutHref({ sinceInput });
    const operationsChangesHref = printoutHref({
        sinceInput,
        content: 'operations',
    });
    const plantsChangesHref = printoutHref({
        sinceInput,
        content: 'plants',
    });
    const invalidSince = Boolean(sinceInput) && !since;
    const menuAllLabel = since ? 'Sve promjene' : 'Cijeli paket';

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                actions={
                    <>
                        <SplitButton
                            href={changesHref}
                            startDecorator={<Printer className="size-4" />}
                            dropdownLabel="Odaberi sadržaj paketa"
                            menuContent={
                                <>
                                    <DropdownMenuItem
                                        href={changesHref}
                                        startDecorator={
                                            <Printer className="size-4" />
                                        }
                                    >
                                        {menuAllLabel}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        href={operationsChangesHref}
                                        startDecorator={
                                            <Hammer className="size-4" />
                                        }
                                    >
                                        Samo radnje
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        href={plantsChangesHref}
                                        startDecorator={
                                            <Sprout className="size-4" />
                                        }
                                    >
                                        Samo biljke/sorte
                                    </DropdownMenuItem>
                                </>
                            }
                        >
                            Preuzmi paket
                        </SplitButton>
                        <Button
                            href={`${KnownPages.FarmerDocumentationPrintout}?scope=all`}
                            variant="outlined"
                            startDecorator={<Book className="size-4" />}
                        >
                            Preuzmi sve
                        </Button>
                    </>
                }
            />

            <Stack spacing={1}>
                <Typography level="h4" component="h1">
                    Dokumentacija farmera
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Ispis priručnika radnji, biljaka i sorti iz farmer
                    aplikacije, organiziran po stabilnim OP, PL i PS kodovima.
                </Typography>
            </Stack>

            <Card>
                <CardContent>
                    <form
                        className="flex flex-wrap items-end gap-3"
                        method="get"
                    >
                        <label className="grid min-w-60 gap-1 text-sm font-medium">
                            Zadnji ispis
                            <input
                                type="date"
                                name="since"
                                defaultValue={sinceInput ?? ''}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </label>
                        <Button type="submit" variant="outlined">
                            Prikaži promjene
                        </Button>
                        {sinceInput && (
                            <Button
                                href={KnownPages.FarmerDocumentation}
                                variant="plain"
                                color="neutral"
                            >
                                Očisti
                            </Button>
                        )}
                    </form>
                    {invalidSince && (
                        <Typography
                            level="body3"
                            className="mt-3 text-amber-700"
                        >
                            Datum nije prepoznat. Prikazan je cijeli priručnik.
                        </Typography>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-7">
                <DocumentationSummaryCard
                    label="Trenutnih priručnika"
                    value={
                        documentationPackage.totalOperations +
                        documentationPackage.totalPlants
                    }
                />
                <DocumentationSummaryCard
                    label="Radnji"
                    value={documentationPackage.totalOperations}
                />
                <DocumentationSummaryCard
                    label="Biljaka"
                    value={documentationPackage.totalPlants}
                />
                <DocumentationSummaryCard
                    label="Sorti"
                    value={documentationPackage.totalPlantSorts}
                />
                <DocumentationSummaryCard
                    label="Stranica u paketu"
                    value={
                        documentationPackage.includedOperations.length +
                        documentationPackage.includedPlants.length
                    }
                />
                <DocumentationSummaryCard
                    label="Za uklanjanje"
                    value={
                        documentationPackage.discardedOperations.length +
                        documentationPackage.discardedPlants.length +
                        documentationPackage.discardedPlantSorts.length
                    }
                />
                <DocumentationSummaryCard
                    label="Od zadnjeg ispisa"
                    value={
                        documentationPackage.since
                            ? formatDocumentationDateTime(
                                  documentationPackage.since,
                              )
                            : 'Sve'
                    }
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Sadržaj paketa</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {packageRows.length > 0 ? (
                        <Table>
                            <Table.Header>
                                <Table.Row>
                                    <Table.Head>Kod</Table.Head>
                                    <Table.Head>Priručnik</Table.Head>
                                    <Table.Head>Vrsta</Table.Head>
                                    <Table.Head>Status</Table.Head>
                                    <Table.Head>Promjena</Table.Head>
                                    <Table.Head>Sažetak</Table.Head>
                                </Table.Row>
                            </Table.Header>
                            <Table.Body>
                                {packageRows.map((row) => (
                                    <Table.Row
                                        key={`${row.changeType}-${row.code}`}
                                    >
                                        <Table.Cell className="font-mono text-sm">
                                            {row.code}
                                        </Table.Cell>
                                        <Table.Cell>{row.label}</Table.Cell>
                                        <Table.Cell className="text-muted-foreground">
                                            {row.documentTypeLabel}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <DocumentationChangeTypeBadge
                                                type={row.changeType}
                                            />
                                        </Table.Cell>
                                        <Table.Cell className="text-muted-foreground">
                                            {formatDocumentationDateTime(
                                                row.changedAt,
                                            )}
                                        </Table.Cell>
                                        <Table.Cell className="text-muted-foreground">
                                            {row.detail}
                                        </Table.Cell>
                                    </Table.Row>
                                ))}
                            </Table.Body>
                        </Table>
                    ) : (
                        <div className="p-6">
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Nema promjena za odabrani datum. PDF će sadržati
                                samo organizacijski vodič.
                            </Typography>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Stack>
    );
}

function singleSearchParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function printoutHref({
    content = 'all',
    sinceInput,
}: {
    content?: FarmerDocumentationPackageContent;
    sinceInput: string | undefined;
}) {
    const params = new URLSearchParams();
    if (sinceInput) {
        params.set('since', sinceInput);
    }
    if (content !== 'all') {
        params.set('content', documentationPackageContentQueryValue(content));
    }

    const query = params.toString();
    return query
        ? `${KnownPages.FarmerDocumentationPrintout}?${query}`
        : KnownPages.FarmerDocumentationPrintout;
}

function packageTableRows(
    documentationPackage: Awaited<
        ReturnType<typeof getFarmerDocumentationPackage>
    >,
): PackageRow[] {
    return [
        ...includedDocumentationPages(documentationPackage).map(
            (page): PackageRow => ({
                code: page.code,
                label: page.label,
                documentTypeLabel: page.documentTypeLabel,
                changeType: page.changeType,
                changedAt: page.changedAt,
                detail: page.revisionActions.join(', ') || 'Aktualna verzija',
            }),
        ),
        ...discardedDocumentationPages(documentationPackage).map(
            (page): PackageRow => ({
                code: page.code,
                label: page.label,
                documentTypeLabel: page.documentTypeLabel,
                changeType: 'discard',
                changedAt: page.changedAt,
                detail: page.revisionActions.join(', '),
            }),
        ),
    ].sort((left, right) => left.code.localeCompare(right.code));
}
