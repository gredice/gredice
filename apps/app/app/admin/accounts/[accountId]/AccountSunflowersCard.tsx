import {
    earnSunflowers,
    getSunflowers,
    getSunflowersHistory,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Input } from '@gredice/ui/Input';
import { Add } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Popper } from '@gredice/ui/Popper';
import { SelectItems } from '@gredice/ui/SelectItems';
import { Stack } from '@gredice/ui/Stack';
import { Table } from '@gredice/ui/Table';
import { Typography } from '@gredice/ui/Typography';
import { revalidatePath } from 'next/cache';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
import { Field } from '../../../../components/shared/fields/Field';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';

export async function AccountSunflowersCard({
    accountId,
}: {
    accountId: string;
}) {
    const currentSunflowers = await getSunflowers(accountId);
    const history = await getSunflowersHistory(accountId, 0, 10000);

    async function submitGiftSunflowers(formData: FormData) {
        'use server';
        await auth(['admin']);
        const amount = formData.get('amount') as string;
        const reason = formData.get('reason') as string;
        await earnSunflowers(accountId, parseInt(amount, 10), reason);
        revalidatePath(KnownPages.Account(accountId));
    }

    return (
        <Card className={scrollableTableCardClassName}>
            <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle>Suncokreti</CardTitle>
                <Popper
                    align="end"
                    className="w-80 p-3"
                    trigger={
                        <IconButton title="Dodjeli suncokrete">
                            <Add className="size-5" />
                        </IconButton>
                    }
                >
                    <Stack spacing={4}>
                        <Typography level="h5">Dodjeli suncokrete</Typography>
                        <form action={submitGiftSunflowers} className="min-w-0">
                            <Stack className="min-w-0" spacing={4}>
                                <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                                    <Input
                                        label="Iznos"
                                        type="number"
                                        name="amount"
                                        defaultValue="0"
                                        fullWidth
                                    />
                                    <SelectItems
                                        className="min-w-0"
                                        label="Razlog"
                                        name="reason"
                                        defaultValue="gift"
                                        items={[
                                            { value: 'gift', label: 'Poklon' },
                                        ]}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    startDecorator={<Add className="size-5" />}
                                >
                                    Dodjeli
                                </Button>
                            </Stack>
                        </form>
                    </Stack>
                </Popper>
            </CardHeader>
            <CardContent className="pb-4">
                <Field name="Ukupno suncokreta" value={currentSunflowers} />
            </CardContent>
            <CardOverflow className={scrollableTableCardOverflowClassName}>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Tip</Table.Head>
                            <Table.Head>Podaci</Table.Head>
                            <Table.Head>Iznos</Table.Head>
                            <Table.Head>Datum kreiranja</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {history.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema suncokreta
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {history.map((sunflower) => (
                            <Table.Row key={sunflower.id}>
                                <Table.Cell>{sunflower.type}</Table.Cell>
                                <Table.Cell>
                                    {JSON.stringify(sunflower.data)}
                                </Table.Cell>
                                <Table.Cell>{sunflower.amount}</Table.Cell>
                                <Table.Cell>
                                    <LocalDateTime>
                                        {sunflower.createdAt}
                                    </LocalDateTime>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}
