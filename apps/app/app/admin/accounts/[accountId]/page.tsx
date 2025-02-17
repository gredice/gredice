import { Card, CardContent, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Breadcrumbs } from "@signalco/ui/Breadcrumbs";
import { earnSunflowers, getAccountGardens, getAccountUsers, getSunflowers, getSunflowersHistory } from "@gredice/storage";
import Link from "next/link";
import { KnownPages } from "../../../../src/KnownPages";
import { Table } from "@signalco/ui-primitives/Table";
import { NoDataPlaceholder } from "../../../../components/shared/placeholders/NoDataPlaceholder";
import { auth } from "../../../../lib/auth/auth";
import { Field } from "../../../../components/shared/fields/Field";
import { Divider } from "@signalco/ui-primitives/Divider";
import { revalidatePath } from "next/cache";
import { Input } from "@signalco/ui-primitives/Input";
import { SelectItems } from "@signalco/ui-primitives/SelectItems";
import { Button } from "@signalco/ui-primitives/Button";
import { Plus } from "lucide-react";

export const dynamic = 'force-dynamic';

async function AccountUsersCard({ accountId }: { accountId: string }) {
    const users = await getAccountUsers(accountId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Korisnici</CardTitle>
            </CardHeader>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Korisnicko ime</Table.Head>
                            <Table.Head>Datum povezivanja</Table.Head>
                            <Table.Head>Datum ažuriranja veze</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {users.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema povezanih korisnika
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {users.map(user => (
                            <Table.Row key={user.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.User(user.user.id)}>
                                        {user.user.userName}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell>
                                    {user.createdAt.toLocaleString('hr-HR')}
                                </Table.Cell>
                                <Table.Cell>
                                    {user.updatedAt.toLocaleString('hr-HR')}
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}

async function AccountGardensCard({ accountId }: { accountId: string }) {
    const gardens = await getAccountGardens(accountId);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Vrtovi</CardTitle>
            </CardHeader>
            <CardOverflow>
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Naziv</Table.Head>
                            <Table.Head>Datum kreiranja</Table.Head>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {gardens.length === 0 && (
                            <Table.Row>
                                <Table.Cell colSpan={3}>
                                    <NoDataPlaceholder>
                                        Nema povezanih vrtova
                                    </NoDataPlaceholder>
                                </Table.Cell>
                            </Table.Row>
                        )}
                        {gardens.map(garden => (
                            <Table.Row key={garden.id}>
                                <Table.Cell>
                                    <Link href={KnownPages.Garden(garden.id)}>
                                        {garden.name}
                                    </Link>
                                </Table.Cell>
                                <Table.Cell title={garden.createdAt.toISOString()}>{garden.createdAt.toLocaleString('hr-HR')}</Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}

async function AccountSunflowersCard({ accountId }: { accountId: string }) {
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
            <CardContent>
                <div className="grid grid-cols-2 gap-2">
                    <Stack spacing={2}>
                        <Field name="Ukupno suncokreta" value={currentSunflowers} />
                    </Stack>
                    <form action={submitGiftSunflowers}>
                        <Stack spacing={1}>
                            <div className="grid grid-cols-2 gap-2">
                                <Input label="Iznos" type="number" name="amount" defaultValue="1000" />
                                <SelectItems
                                    label="Razlog"
                                    name="reason"
                                    defaultValue='gift'
                                    items={[
                                        { value: 'gift', label: 'Poklon' }
                                    ]} />
                            </div>
                            <Button size="sm" type="submit" startDecorator={<Plus className="size-5" />}>Pridjeli</Button>
                        </Stack>
                    </form>
                </div>
            </CardContent>
            <CardOverflow>
                <Divider />
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.Head>Tip</Table.Head>
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
                                    {sunflower.amount}
                                </Table.Cell>
                                <Table.Cell title={sunflower.createdAt.toISOString()}>{sunflower.createdAt.toLocaleString('hr-HR')}</Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}

export default async function AccountPage({ params }: { params: Promise<{ accountId: string; }> }) {
    const { accountId } = await params;
    await auth(['admin']);

    return (
        <Stack spacing={2}>
            <Card>
                <CardHeader>
                    <Stack spacing={2}>
                        <Breadcrumbs items={[
                            { label: 'Računi', href: KnownPages.Accounts },
                            { label: accountId }
                        ]} />
                        <CardTitle>Račun</CardTitle>
                    </Stack>
                </CardHeader>
                <CardContent>
                    <Stack spacing={2}>
                        <Field name="ID računa" value={accountId} />
                    </Stack>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AccountUsersCard accountId={accountId} />
                <AccountGardensCard accountId={accountId} />
                <AccountSunflowersCard accountId={accountId} />
            </div>
        </Stack>
    );
}