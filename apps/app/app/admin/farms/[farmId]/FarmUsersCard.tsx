import { getFarmUsers, getUsers } from '@gredice/storage';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';
import { AssignFarmUserForm } from './AssignFarmUserForm';

export async function FarmUsersCard({ farmId }: { farmId: number }) {
    const [farmUsers, users] = await Promise.all([
        getFarmUsers(farmId),
        getUsers(),
    ]);

    const assignedUserIds = farmUsers.map((farmUser) => farmUser.userId);
    const userOptions = users.map((user) => ({
        id: user.id,
        label: user.displayName
            ? `${user.displayName} (${user.userName})`
            : user.userName,
    }));

    return (
        <Card>
            <CardHeader>
                <CardTitle>Korisnici na farmi</CardTitle>
            </CardHeader>
            <CardContent>
                <AssignFarmUserForm
                    farmId={farmId}
                    users={userOptions}
                    assignedUserIds={assignedUserIds}
                />
            </CardContent>
            <CardOverflow>
                {farmUsers.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Nema dodijeljenih korisnika
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {farmUsers.map((farmUser) => (
                            <li
                                key={farmUser.id}
                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                            >
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <Link
                                            href={KnownPages.User(
                                                farmUser.userId,
                                            )}
                                            className="min-w-0 break-words text-sm font-medium text-primary underline-offset-4 hover:underline"
                                        >
                                            {farmUser.user?.userName ??
                                                farmUser.userId}
                                        </Link>
                                        <Typography
                                            level="body3"
                                            className="mt-1 text-muted-foreground"
                                        >
                                            Prikazano ime:{' '}
                                            <span className="text-foreground">
                                                {farmUser.user?.displayName ??
                                                    '—'}
                                            </span>
                                        </Typography>
                                    </div>
                                    <Typography
                                        component="div"
                                        level="body3"
                                        className="text-muted-foreground sm:text-right"
                                    >
                                        Dodano:{' '}
                                        <LocalDateTime>
                                            {farmUser.createdAt}
                                        </LocalDateTime>
                                    </Typography>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
