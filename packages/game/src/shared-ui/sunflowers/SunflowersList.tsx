import { getAchievementDefinition } from '@gredice/js/achievements';
import { AchievementAward } from '@gredice/ui/AchievementAwards';
import { BlockImage } from '@gredice/ui/BlockImage';
import {
    GameBasketIcon,
    GameBirthdayIcon,
    GameCalendarIcon,
    GameCommunityIcon,
    GameGiftIcon,
    GameHistoryIcon,
    GameReceiptIcon,
    GameRefundIcon,
    GameSunflowerIcon,
    GameTasksIcon,
} from '@gredice/ui/GameIcons';
import { List } from '@gredice/ui/List';
import { ListItem } from '@gredice/ui/ListItem';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { SunflowerPackageVisual } from '@gredice/ui/SunflowerVisuals';
import { Typography } from '@gredice/ui/Typography';
import Image from 'next/image';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { formatSunflowers } from '../../utils/sunflowerPricing';
import { NoSunflowersPlaceholder } from './NoSunflowersPlaceholder';

function sunflowerReasonToDescription(reason: string) {
    if (reason === 'registration') {
        return {
            icon: (
                <AchievementAward
                    achievementKey="registration"
                    className="size-10"
                    aria-hidden
                />
            ),
            label: 'Nagrada za registraciju',
        };
    }

    if (reason.startsWith('achievement')) {
        const key = reason.split(':')[1];
        const definition = key ? getAchievementDefinition(key) : undefined;
        return {
            icon: (
                <AchievementAward
                    achievementKey={key ?? 'unknown'}
                    className="size-10"
                    aria-hidden
                />
            ),
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
            icon: <GameGiftIcon className="size-10 shrink-0" aria-hidden />,
            label: 'Poklon',
        };
    }
    if (reason.startsWith('daily')) {
        return {
            icon: <GameCalendarIcon className="size-10 shrink-0" aria-hidden />,
            label: 'Dnevna aktivnost',
        };
    }
    if (reason.startsWith('tutorial')) {
        return {
            icon: <GameTasksIcon className="size-10 shrink-0" aria-hidden />,
            label: 'Zadaci za novi vrt',
        };
    }
    if (reason === 'sunflowerDrop') {
        return {
            icon: (
                <GameSunflowerIcon className="size-10 shrink-0" aria-hidden />
            ),
            label: 'Suncokret iz vrta',
        };
    }
    if (reason === 'payment') {
        return {
            icon: <GameReceiptIcon className="size-10 shrink-0" aria-hidden />,
            label: 'Plaćanje',
        };
    }
    if (reason.startsWith('sunflowerPackage:')) {
        return {
            icon: (
                <SunflowerPackageVisual
                    packageCode={reason.split(':')[1]}
                    className="size-10 shrink-0"
                    aria-hidden
                />
            ),
            label: 'Kupnja paketa suncokreta',
        };
    }
    if (
        reason.startsWith('shoppingCart:') ||
        reason.startsWith('shoppingCartItem:')
    ) {
        return {
            icon: <GameBasketIcon className="size-10 shrink-0" aria-hidden />,
            label: 'Kupnja',
        };
    }
    if (reason.startsWith('refund:operation')) {
        return {
            icon: <GameRefundIcon className="size-10 shrink-0" aria-hidden />,
            label: 'Povrat sredstava za radnju',
        };
    }

    if (reason.startsWith('referral')) {
        return {
            icon: (
                <GameCommunityIcon className="size-10 shrink-0" aria-hidden />
            ),
            label: 'Referral nagrada',
        };
    }

    if (reason.startsWith('birthday')) {
        return {
            icon: <GameBirthdayIcon className="size-10 shrink-0" aria-hidden />,
            label: 'Rođendanski poklon',
        };
    }

    console.warn('Unknown sunflower reason:', reason);
    return {
        icon: <GameHistoryIcon className="size-10 shrink-0" aria-hidden />,
        label: 'Nepoznato',
    };
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
                                <GameBasketIcon
                                    className="size-10 shrink-0"
                                    aria-hidden
                                />
                                <Stack>
                                    <Typography level="body2">
                                        U košari
                                    </Typography>
                                    <Typography level="body3">
                                        Privremeno rezervirano
                                    </Typography>
                                </Stack>
                            </Row>
                            <Typography className="shrink-0 whitespace-nowrap text-red-700 tabular-nums dark:text-red-400">
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
                                    className={
                                        event.totalAmount > 0
                                            ? 'shrink-0 whitespace-nowrap text-green-700 tabular-nums dark:text-green-400'
                                            : 'shrink-0 whitespace-nowrap text-red-700 tabular-nums dark:text-red-400'
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
