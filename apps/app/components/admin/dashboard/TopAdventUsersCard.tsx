import type { AdventCalendarTopUser } from '@gredice/storage';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';

type TopAdventUsersCardProps = {
    users: AdventCalendarTopUser[];
    year: number;
};

export function TopAdventUsersCard({ users, year }: TopAdventUsersCardProps) {
    return (
        <Card>
            <CardOverflow>
                <Stack spacing={1} className="p-4">
                    <Typography level="h2" className="text-lg" semiBold>
                        Advent {year} - top korisnici
                    </Typography>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Korisnik</Table.Head>
                                <Table.Head className="text-right">
                                    Otvoreni dani
                                </Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {users.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={2}>
                                        <NoDataPlaceholder>
                                            Nema otvorenih dana
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {users.map((user) => (
                                <Table.Row key={user.userId}>
                                    <Table.Cell>
                                        {user.displayName ||
                                            user.userName ||
                                            user.userId}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        {user.openedDays}
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </Stack>
            </CardOverflow>
        </Card>
    );
}
