import { getAchievementDefinition } from '@gredice/js/achievements';
import { BlockImage } from '@gredice/ui/BlockImage';
import { Empty, ShoppingCart as ShoppingCartIcon } from '@gredice/ui/icons';
import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Image from 'next/image';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { formatSunflowers } from '../../utils/sunflowerPricing';
import { NoSunflowersPlaceholder } from './NoSunflowersPlaceholder';

function sunflowerReasonToDescription(reason: string) {
    if (reason === 'registration') {
        return {
            icon: <span className="text-4xl text-center size-10">🎉</span>,
            label: 'Nagrada za registraciju',
        };
    }

    if (reason.startsWith('achievement')) {
        const key = reason.split(':')[1];
        const definition = key ? getAchievementDefinition(key) : undefined;
        return {
            icon: <span className="text-4xl text-center size-10">🏆</span>,
            label: definition
                ? `Postignuće: ${definition.title}`
                : 'Nagrada za postignuće',
        };
    }

    if (reason.startsWith('block')) {
        return {
            icon: (
                <BlockImage
                    blockName={reason.split(':')[1]}
                    className="size-10"
                    width={40}
                    height={40}
                />
            ),
            label: 'Postavljanje bloka',
        };
    }
    if (reason.startsWith('recycle')) {
        return {
            icon: (
                <div className="relative size-10">
                    <BlockImage
                        blockName={reason.split(':')[1]}
                        className="absolute inset-0 size-10"
                        width={40}
                        height={40}
                    />
                    <Image
                        src={
                            'https://vrt.gredice.com/assets/textures/recycle.png'
                        }
                        alt="Recikliranje"
                        width={20}
                        height={20}
                        className="absolute top-0 right-0 size-5 opacity-50"
                    />
                </div>
            ),
            label: 'Recikliranje bloka',
        };
    }
    if (reason === 'gift') {
        return {
            icon: <span className="text-4xl text-center size-10">🎁</span>,
            label: 'Poklon',
        };
    }
    if (reason.startsWith('daily')) {
        return {
            icon: <span className="text-4xl text-center size-10">📅</span>,
            label: 'Dnevna aktivnost',
        };
    }
    if (reason === 'payment') {
        return {
            icon: <span className="text-4xl text-center size-10">💰</span>,
            label: 'Plaćanje',
        };
    }
    if (
        reason.startsWith('shoppingCart:') ||
        reason.startsWith('shoppingCartItem:')
    ) {
        return {
            icon: <span className="text-4xl text-center size-10">🛒</span>,
            label: 'Kupnja',
        };
    }
    if (reason.startsWith('refund:operation')) {
        return {
            icon: <span className="text-4xl text-center size-10">↩️</span>,
            label: 'Povrat sredstava za radnju',
        };
    }

    if (reason.startsWith('referral')) {
        return {
            icon: <span className="text-4xl text-center size-10">💮</span>,
            label: 'Referral nagrada',
        };
    }

    if (reason.startsWith('birthday')) {
        return {
            icon: <span className="text-4xl text-center size-10">🎂</span>,
            label: 'Rođendanski poklon',
        };
    }

    console.warn('Unknown sunflower reason:', reason);
    return { icon: <Empty className="size-10" />, label: 'Nepoznato' };
}

export function SunflowersList({
    limit,
    pendingSunflowers = 0,
}: {
    limit?: number;
    pendingSunflowers?: number;
}) {
    const { data: account } = useCurrentAccount();
    const history = account?.sunflowers.history ?? [];
    const hasPendingSunflowers = pendingSunflowers > 0;

    if (!history.length && !hasPendingSunflowers) {
        return (
            <div className="px-2 py-4">
                <NoSunflowersPlaceholder />
            </div>
        );
    }

    // Group similar items on a daily basis
    const historyGrouped = history.reduce((acc, event) => {
        const eventDate = new Date(event.createdAt).toLocaleDateString('hr-HR');
        const eventReasonGroup =
            typeof event.reason === 'string'
                ? event.reason.split(':')[0]
                : 'unknown';
        const key = `${eventDate}-${eventReasonGroup}-${event.amount}`;

        if (!acc.has(key)) {
            acc.set(key, {
                ...event,
                totalAmount: event.amount,
                count: 1,
            });
        } else {
            const existingEvent = acc.get(key);
            if (!existingEvent) {
                return acc;
            }
            existingEvent.totalAmount += event.amount;
            existingEvent.count += 1;
        }

        return acc;
    }, new Map<
        string,
        (typeof history)[0] & { count: number; totalAmount: number }
    >());
    const historyGroupedArray = Array.from(historyGrouped.values());
    const actualLimit =
        typeof limit === 'number' && hasPendingSunflowers
            ? Math.max(limit - 1, 0)
            : (limit ?? historyGroupedArray.length);

    return (
        <List>
            {hasPendingSunflowers && (
                <ListItem
                    label={
                        <Row spacing={2} justifyContent="space-between">
                            <Row spacing={4}>
                                <div className="size-10 flex items-center justify-center rounded-full bg-yellow-100 text-yellow-800">
                                    <ShoppingCartIcon className="size-5 shrink-0" />
                                </div>
                                <Stack>
                                    <Typography level="body2">
                                        U košari
                                    </Typography>
                                    <Typography level="body3">
                                        Privremeno rezervirano
                                    </Typography>
                                </Stack>
                            </Row>
                            <Typography color="danger">
                                {formatSunflowers(-pendingSunflowers)}
                            </Typography>
                        </Row>
                    }
                />
            )}
            {historyGroupedArray.slice(0, actualLimit).map((event) => {
                const description = sunflowerReasonToDescription(
                    typeof event.reason === 'string' ? event.reason : '',
                );
                return (
                    <ListItem
                        key={event.id}
                        label={
                            <Row spacing={2} justifyContent="space-between">
                                <Row spacing={4}>
                                    {description.icon}
                                    <Stack>
                                        <Row spacing={2}>
                                            <Typography level="body2">
                                                {description.label}
                                            </Typography>
                                            <Typography secondary>
                                                {event.count > 1
                                                    ? `x${event.count}`
                                                    : ''}
                                            </Typography>
                                        </Row>
                                        <Typography level="body3">
                                            {new Date(
                                                event.createdAt,
                                            ).toLocaleDateString('hr-HR', {
                                                day: 'numeric',
                                                month: 'long',
                                                year: 'numeric',
                                            })}
                                        </Typography>
                                    </Stack>
                                </Row>
                                <Typography
                                    color={
                                        event.totalAmount > 0
                                            ? 'success'
                                            : 'danger'
                                    }
                                >
                                    {event.totalAmount > 0
                                        ? `+${formatSunflowers(event.totalAmount)}`
                                        : formatSunflowers(event.totalAmount)}
                                </Typography>
                            </Row>
                        }
                    />
                );
            })}
        </List>
    );
}
