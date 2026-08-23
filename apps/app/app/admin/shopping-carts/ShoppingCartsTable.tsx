import { getAllShoppingCarts } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';

const itemAmountFormatter = new Intl.NumberFormat('hr-HR');

function formatItemCount(count: number) {
    const absCount = Math.abs(count);
    const mod10 = absCount % 10;
    const mod100 = absCount % 100;
    const suffix =
        mod10 === 1 && mod100 !== 11
            ? 'stavka'
            : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
              ? 'stavke'
              : 'stavki';

    return `${itemAmountFormatter.format(count)} ${suffix}`;
}

function formatStatus(status: string) {
    if (status === 'paid') {
        return 'Plaćena';
    }
    if (status === 'new') {
        return 'Nova';
    }

    return status;
}

export async function ShoppingCartsTable({
    accountId,
    showIdColumn = true,
    showAccountColumn = !accountId,
}: {
    accountId?: string;
    showIdColumn?: boolean;
    showAccountColumn?: boolean;
}) {
    await auth(['admin']);
    const allShoppingCarts = await getAllShoppingCarts({
        status: null,
        filter: { accountId },
    });

    // Sort shopping carts by newest first (updatedAt descending)
    const shoppingCarts = (allShoppingCarts || []).sort(
        (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return (
        <div className="min-w-0">
            {shoppingCarts.length === 0 ? (
                <div className="p-4">
                    <NoDataPlaceholder>Nema košarica</NoDataPlaceholder>
                </div>
            ) : (
                <ul className="divide-y">
                    {shoppingCarts.map((cart) => {
                        const user = cart.account?.accountUsers.at(0)?.user;
                        const userName = user?.displayName || user?.userName;
                        const cartHref = KnownPages.ShoppingCart(cart.id);
                        const totalItemAmount = cart.items.reduce(
                            (sum, item) => sum + item.amount,
                            0,
                        );
                        const itemCount = (
                            <Chip color="neutral" size="sm" variant="soft">
                                {formatItemCount(cart.items.length)}
                            </Chip>
                        );
                        return (
                            <li
                                key={cart.id}
                                className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                            >
                                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="min-w-0">
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            {showIdColumn ? (
                                                <Link
                                                    href={cartHref}
                                                    className="min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                >
                                                    Košarica #{cart.id}
                                                </Link>
                                            ) : user ? (
                                                <Link
                                                    href={KnownPages.User(
                                                        user.id,
                                                    )}
                                                    className="min-w-0 truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
                                                >
                                                    {userName}
                                                </Link>
                                            ) : (
                                                <Typography
                                                    component="span"
                                                    level="body2"
                                                    className="text-muted-foreground"
                                                >
                                                    Nema korisnika
                                                </Typography>
                                            )}
                                        </div>

                                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                            {showAccountColumn ? (
                                                cart.accountId ? (
                                                    <Link
                                                        href={KnownPages.Account(
                                                            cart.accountId,
                                                        )}
                                                        className="min-w-0 truncate text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                                                    >
                                                        Račun:{' '}
                                                        {cart.accountId.slice(
                                                            0,
                                                            6,
                                                        )}
                                                        ...
                                                    </Link>
                                                ) : (
                                                    <Typography
                                                        component="span"
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Nema računa
                                                    </Typography>
                                                )
                                            ) : null}

                                            {showIdColumn ? (
                                                user ? (
                                                    <Link
                                                        href={KnownPages.User(
                                                            user.id,
                                                        )}
                                                        className="min-w-0 truncate text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                                                    >
                                                        Korisnik: {userName}
                                                    </Link>
                                                ) : (
                                                    <Typography
                                                        component="span"
                                                        level="body3"
                                                        className="text-muted-foreground"
                                                    >
                                                        Nema korisnika
                                                    </Typography>
                                                )
                                            ) : null}
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                            {showIdColumn ? (
                                                itemCount
                                            ) : (
                                                <Link
                                                    href={cartHref}
                                                    className="inline-flex"
                                                >
                                                    {itemCount}
                                                </Link>
                                            )}
                                            <Chip
                                                color="neutral"
                                                size="sm"
                                                variant="outlined"
                                            >
                                                Količina:{' '}
                                                {itemAmountFormatter.format(
                                                    totalItemAmount,
                                                )}
                                            </Chip>
                                            <Chip
                                                color={
                                                    cart.status === 'paid'
                                                        ? 'success'
                                                        : 'neutral'
                                                }
                                                size="sm"
                                                variant="soft"
                                            >
                                                {formatStatus(cart.status)}
                                            </Chip>
                                        </div>

                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground lg:text-right"
                                        >
                                            Ažurirano:{' '}
                                            <span className="whitespace-nowrap">
                                                <LocalDateTime time={false}>
                                                    {cart.updatedAt}
                                                </LocalDateTime>
                                            </span>
                                        </Typography>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
