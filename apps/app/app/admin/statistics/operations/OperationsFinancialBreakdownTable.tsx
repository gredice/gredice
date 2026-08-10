import { formatPrice } from '@gredice/js/currency';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { formatOperationsDuration } from '../../../../components/admin/dashboard/operationsDuration';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import type { OperationFinancialBreakdown } from './operationFinancialBreakdown';

function missingPriceLabel(count: number) {
    if (count === 1) {
        return '1 zadatak bez cijene';
    }

    return `${count.toString()} zadataka bez cijene`;
}

function incompleteEarningsLabel(count: number) {
    if (count === 1) {
        return '1 zadatak bez potpunog izračuna';
    }

    return `${count.toString()} zadataka bez potpunog izračuna`;
}

export function OperationsFinancialBreakdownTable({
    data,
}: {
    data: OperationFinancialBreakdown;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Radnje i sijanja po vrsti</CardTitle>
                <Typography level="body3" className="text-muted-foreground">
                    Završeni zadaci u odabranom razdoblju. Iznosi koriste
                    trenutačne korisničke cijene i cijene farmera za farmu
                    zadatka te procijenjeni trošak materijala definiran na
                    radnji.
                </Typography>
            </CardHeader>

            {data.rows.length === 0 ? (
                <CardContent>
                    <NoDataPlaceholder>
                        Nema završenih radnji ni verificiranih sijanja u
                        odabranom razdoblju.
                    </NoDataPlaceholder>
                </CardContent>
            ) : (
                <CardOverflow>
                    <Table className="min-w-[1080px]">
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Vrsta zadatka</Table.Head>
                                <Table.Head className="text-right">
                                    Broj zadataka
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Ukupno trajanje
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Trošak farmera
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Trošak materijala
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Trošak korisnika
                                </Table.Head>
                                <Table.Head className="text-right">
                                    Procijenjena zarada
                                </Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {data.rows.map((row) => (
                                <Table.Row key={row.key}>
                                    <Table.Cell className="font-medium">
                                        {row.label}
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums">
                                        {row.taskCount}
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums whitespace-nowrap">
                                        {formatOperationsDuration(
                                            row.totalDurationMinutes,
                                        )}
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums">
                                        <div>{formatPrice(row.farmerCost)}</div>
                                        {row.missingFarmerPriceCount > 0 ? (
                                            <Typography
                                                level="body3"
                                                className="whitespace-nowrap text-amber-700 dark:text-amber-300"
                                            >
                                                {missingPriceLabel(
                                                    row.missingFarmerPriceCount,
                                                )}
                                            </Typography>
                                        ) : null}
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums">
                                        {formatPrice(row.materialCost)}
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums">
                                        <div>{formatPrice(row.userCost)}</div>
                                        {row.missingUserPriceCount > 0 ? (
                                            <Typography
                                                level="body3"
                                                className="whitespace-nowrap text-amber-700 dark:text-amber-300"
                                            >
                                                {missingPriceLabel(
                                                    row.missingUserPriceCount,
                                                )}
                                            </Typography>
                                        ) : null}
                                    </Table.Cell>
                                    <Table.Cell className="text-right tabular-nums font-medium">
                                        <div
                                            className={
                                                row.estimatedEarnings < 0
                                                    ? 'text-destructive'
                                                    : undefined
                                            }
                                        >
                                            {formatPrice(row.estimatedEarnings)}
                                        </div>
                                        {row.incompleteEarningsCount > 0 ? (
                                            <Typography
                                                level="body3"
                                                className="whitespace-nowrap text-amber-700 dark:text-amber-300"
                                            >
                                                {incompleteEarningsLabel(
                                                    row.incompleteEarningsCount,
                                                )}
                                            </Typography>
                                        ) : null}
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                            <Table.Row className="bg-muted/40 font-medium hover:bg-muted/40">
                                <Table.Cell>Ukupno</Table.Cell>
                                <Table.Cell className="text-right tabular-nums">
                                    {data.totals.taskCount}
                                </Table.Cell>
                                <Table.Cell className="text-right tabular-nums whitespace-nowrap">
                                    {formatOperationsDuration(
                                        data.totals.totalDurationMinutes,
                                    )}
                                </Table.Cell>
                                <Table.Cell className="text-right tabular-nums">
                                    <div>
                                        {formatPrice(data.totals.farmerCost)}
                                    </div>
                                    {data.totals.missingFarmerPriceCount > 0 ? (
                                        <Typography
                                            level="body3"
                                            className="whitespace-nowrap text-amber-700 dark:text-amber-300"
                                        >
                                            {missingPriceLabel(
                                                data.totals
                                                    .missingFarmerPriceCount,
                                            )}
                                        </Typography>
                                    ) : null}
                                </Table.Cell>
                                <Table.Cell className="text-right tabular-nums">
                                    {formatPrice(data.totals.materialCost)}
                                </Table.Cell>
                                <Table.Cell className="text-right tabular-nums">
                                    <div>
                                        {formatPrice(data.totals.userCost)}
                                    </div>
                                    {data.totals.missingUserPriceCount > 0 ? (
                                        <Typography
                                            level="body3"
                                            className="whitespace-nowrap text-amber-700 dark:text-amber-300"
                                        >
                                            {missingPriceLabel(
                                                data.totals
                                                    .missingUserPriceCount,
                                            )}
                                        </Typography>
                                    ) : null}
                                </Table.Cell>
                                <Table.Cell className="text-right tabular-nums font-semibold">
                                    <div
                                        className={
                                            data.totals.estimatedEarnings < 0
                                                ? 'text-destructive'
                                                : undefined
                                        }
                                    >
                                        {formatPrice(
                                            data.totals.estimatedEarnings,
                                        )}
                                    </div>
                                    {data.totals.incompleteEarningsCount > 0 ? (
                                        <Typography
                                            level="body3"
                                            className="whitespace-nowrap text-amber-700 dark:text-amber-300"
                                        >
                                            {incompleteEarningsLabel(
                                                data.totals
                                                    .incompleteEarningsCount,
                                            )}
                                        </Typography>
                                    ) : null}
                                </Table.Cell>
                            </Table.Row>
                        </Table.Body>
                    </Table>
                </CardOverflow>
            )}
        </Card>
    );
}
