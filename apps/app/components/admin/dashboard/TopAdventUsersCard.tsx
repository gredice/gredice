import type { AdventCalendarTopUser } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { KnownPages } from '../../../src/KnownPages';
import { NoDataPlaceholder } from '../../shared/placeholders/NoDataPlaceholder';

type TopAdventUsersCardProps = {
    users: AdventCalendarTopUser[];
    year: number;
};

function userLabel(user: AdventCalendarTopUser) {
    return user.displayName || user.userName || user.userId;
}

export function TopAdventUsersCard({ users, year }: TopAdventUsersCardProps) {
    return (
        <Card>
            <CardOverflow>
                <Stack spacing={0}>
                    <div className="p-4 pb-3">
                        <Typography level="h2" className="text-lg" semiBold>
                            Advent {year} - top korisnici
                        </Typography>
                    </div>
                    {users.length === 0 ? (
                        <div className="px-4 pb-4">
                            <NoDataPlaceholder>
                                Nema otvorenih dana
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y border-t">
                            {users.map((user, index) => (
                                <li
                                    key={user.userId}
                                    className="px-4 py-3 transition-colors hover:bg-muted/40"
                                >
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <Chip
                                                color="neutral"
                                                size="sm"
                                                variant="soft"
                                                className="mt-0.5"
                                            >
                                                #{index + 1}
                                            </Chip>
                                            <Link
                                                href={KnownPages.User(
                                                    user.userId,
                                                )}
                                                className="block min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                            >
                                                {userLabel(user)}
                                            </Link>
                                        </div>
                                        <div className="flex min-w-0 justify-start pl-9 sm:justify-end sm:pl-0">
                                            <Chip
                                                color="neutral"
                                                size="sm"
                                                variant="outlined"
                                            >
                                                Otvoreni dani: {user.openedDays}
                                            </Chip>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Stack>
            </CardOverflow>
        </Card>
    );
}
