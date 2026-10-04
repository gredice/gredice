import { getAccountUsers } from '@gredice/storage';
import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import {
    scrollableTableCardClassName,
    scrollableTableCardOverflowClassName,
} from '../../../../components/admin/cards/tableCardLayout';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';

export async function AccountUsersCard({ accountId }: { accountId: string }) {
    const users = await getAccountUsers(accountId);

    return (
        <Card className={scrollableTableCardClassName}>
            <CardHeader>
                <CardTitle>Korisnici</CardTitle>
            </CardHeader>
            <CardOverflow className={scrollableTableCardOverflowClassName}>
                {users.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Nema povezanih korisnika
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {users.map((user) => (
                            <li
                                key={user.id}
                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                            >
                                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <Link
                                            href={KnownPages.User(user.user.id)}
                                            className="min-w-0 break-words text-sm font-medium text-primary underline-offset-4 hover:underline"
                                        >
                                            {user.user.userName}
                                        </Link>
                                        <Typography
                                            level="body3"
                                            className="mt-1 text-muted-foreground"
                                        >
                                            Korisnik računa
                                        </Typography>
                                    </div>
                                    <div className="flex min-w-0 flex-col gap-1 text-left sm:items-end sm:text-right">
                                        <Typography
                                            component="div"
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Povezan:{' '}
                                            <LocalDateTime>
                                                {user.createdAt}
                                            </LocalDateTime>
                                        </Typography>
                                        <Typography
                                            component="div"
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Ažurirano:{' '}
                                            <LocalDateTime>
                                                {user.updatedAt}
                                            </LocalDateTime>
                                        </Typography>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
