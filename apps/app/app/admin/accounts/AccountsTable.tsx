import { getAccounts } from '@gredice/storage';
import { List, ListItem } from '@gredice/ui/List';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';

export async function AccountsTable({ from }: { from?: Date | null }) {
    // Get all accounts
    const allAccounts = await getAccounts();

    // Apply filters
    let filteredAccounts = allAccounts;

    // Apply date filter
    if (from) {
        filteredAccounts = filteredAccounts.filter((account) => {
            return account.createdAt && account.createdAt >= from;
        });
    }

    if (filteredAccounts.length === 0) {
        return (
            <div className="p-4">
                <NoDataPlaceholder>Nema računa</NoDataPlaceholder>
            </div>
        );
    }

    return (
        <List className="min-w-0 divide-y">
            {filteredAccounts.map((account) => {
                const user = account.accountUsers.at(0)?.user;
                const username = user?.displayName || user?.userName || 'N/A';

                return (
                    <ListItem
                        key={account.id}
                        className="rounded-none px-3 py-3 hover:bg-muted/40 sm:px-4"
                        label={
                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <Stack spacing={1} className="min-w-0">
                                    <Link
                                        href={KnownPages.Account(account.id)}
                                        className="min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                    >
                                        {username}
                                    </Link>
                                    {user ? (
                                        <Link
                                            href={KnownPages.User(user.id)}
                                            className="min-w-0 truncate text-xs text-muted-foreground underline-offset-4 hover:underline"
                                        >
                                            Profil korisnika
                                        </Link>
                                    ) : (
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            Nema povezanog korisnika
                                        </Typography>
                                    )}
                                </Stack>
                                <div className="flex min-w-0 flex-col gap-1 text-left sm:items-end sm:text-right">
                                    <Typography
                                        component="div"
                                        level="body3"
                                        className="flex min-w-0 max-w-full items-center gap-1 text-muted-foreground"
                                    >
                                        <span className="shrink-0">ID</span>
                                        <Link
                                            href={KnownPages.Account(
                                                account.id,
                                            )}
                                            title={account.id}
                                            className="min-w-0 truncate font-mono text-primary underline-offset-4 hover:underline"
                                        >
                                            {account.id}
                                        </Link>
                                    </Typography>
                                    <Typography
                                        component="div"
                                        level="body3"
                                        className="whitespace-nowrap text-muted-foreground"
                                    >
                                        <LocalDateTime time={false}>
                                            {account.createdAt}
                                        </LocalDateTime>
                                    </Typography>
                                </div>
                            </div>
                        }
                    />
                );
            })}
        </List>
    );
}
