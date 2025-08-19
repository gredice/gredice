import { getSunflowers, getSunflowersHistory, earnSunflowers } from "@gredice/storage";
import { Card, CardHeader, CardTitle, CardContent, CardOverflow } from "@signalco/ui-primitives/Card";
import { Divider } from "@signalco/ui-primitives/Divider";
import { Input } from "@signalco/ui-primitives/Input";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { Stack } from "@signalco/ui-primitives/Stack";
import { revalidatePath } from "next/cache";
import { Field } from "../../../../components/shared/fields/Field";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { auth } from "../../../../lib/auth/auth";
import { KnownPages } from "../../../../src/KnownPages";
import { Button } from "@signalco/ui-primitives/Button";
import { Table } from "@signalco/ui-primitives/Table";
import { Add } from "@signalco/ui-icons";

export async function AccountSunflowersCard({ accountId }: { accountId: string }) {
    const currentSunflowers = await getSunflowers(accountId);
    const history = await getSunflowersHistory(accountId, 0, 10000);

    async function submitGiftSunflowers(formData: FormData) {
        'use server';
        await auth(['admin']);
        const amount = formData.get('amount') as string;
        const reason = formData.get('reason') as string;
        await earnSunflowers(accountId, parseInt(amount), reason);
        revalidatePath(KnownPages.Account(accountId));
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Suncokreti</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="grid grid-cols-2 gap-2">
                    <Stack spacing={2}>
                        <Field name="Ukupno suncokreta" value={currentSunflowers} />
                    </Stack>
                    <form action={submitGiftSunflowers}>
                        <Stack spacing={1}>
                            <div className="grid grid-cols-2 gap-2">
                                <Input label="Iznos" type="number" name="amount" defaultValue="0" />
                                <SelectItems
                                    label="Razlog"
                                    name="reason"
                                    defaultValue='gift'
                                    items={[
                                        { value: 'gift', label: 'Poklon' }
                                    ]} />
                            </div>
                            <Button type="submit" startDecorator={<Add className="size-5" />}>Dodjeli</Button>
                        </Stack>
                    </form>
                </div>
            </CardContent>
            <CardOverflow>
                <Divider />
                <div className="max-h-80 overflow-auto">
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
                            {history.map(sunflower => (
                                <Table.Row key={sunflower.id}>
                                    <Table.Cell>
                                        {sunflower.type}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {JSON.stringify(sunflower.data)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {sunflower.amount}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime>
                                            {sunflower.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </div>
            </CardOverflow>
        </Card>
    );
}