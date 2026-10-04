import {
    GameControllerIcon,
    GameDeliveryIcon,
    GameGardenIcon,
    GameGiftIcon,
    GameLockIcon,
    GameMailboxIcon,
    GameProfileIcon,
    GameReceiptIcon,
    GameSettingsIcon,
    GameSpeakerIcon,
    GameSunflowerIcon,
    GameTrophyIcon,
} from '@gredice/ui/GameIcons';
import type { ReactElement } from 'react';

type OverviewNavItem = {
    nodeId: string;
    icon: ReactElement;
    label: string;
    value: string;
    href?: '/racun/naplata';
};

type OverviewNavGroup = {
    label: string;
    items: OverviewNavItem[];
};

export const overviewNavGroups: OverviewNavGroup[] = [
    {
        label: 'Profil',
        items: [
            {
                nodeId: 'profile-general',
                icon: (
                    <GameSettingsIcon aria-hidden className="size-6 shrink-0" />
                ),
                label: 'Generalno',
                value: 'generalno',
            },
            {
                nodeId: 'profile-achievements',
                icon: (
                    <GameTrophyIcon aria-hidden className="size-6 shrink-0" />
                ),
                label: 'Postignuća',
                value: 'postignuca',
            },
            {
                nodeId: 'profile-sunflowers',
                icon: (
                    <GameSunflowerIcon
                        aria-hidden
                        className="size-6 shrink-0"
                    />
                ),
                label: 'Suncokreti',
                value: 'suncokreti',
            },
            {
                nodeId: 'profile-delivery',
                icon: (
                    <GameDeliveryIcon aria-hidden className="size-6 shrink-0" />
                ),
                label: 'Dostava',
                value: 'dostava',
            },
            {
                nodeId: 'profile-notifications',
                icon: (
                    <GameMailboxIcon aria-hidden className="size-6 shrink-0" />
                ),
                label: 'Obavijesti',
                value: 'obavijesti',
            },
            {
                nodeId: 'profile-referrals',
                icon: <GameGiftIcon aria-hidden className="size-6 shrink-0" />,
                label: 'Preporuke',
                value: 'preporuke',
            },
        ],
    },
    {
        label: 'Račun',
        items: [
            {
                nodeId: 'account-garden',
                icon: (
                    <GameGardenIcon aria-hidden className="size-6 shrink-0" />
                ),
                label: 'Vrt',
                value: 'vrt',
            },
            {
                nodeId: 'account-users',
                icon: (
                    <GameProfileIcon aria-hidden className="size-6 shrink-0" />
                ),
                label: 'Korisnici',
                value: 'korisnici',
            },
            {
                nodeId: 'account-billing',
                icon: (
                    <GameReceiptIcon aria-hidden className="size-6 shrink-0" />
                ),
                label: 'Računi i plaćanja',
                value: 'racuni',
                href: '/racun/naplata',
            },
        ],
    },
    {
        label: 'Postavke',
        items: [
            {
                nodeId: 'settings-game',
                icon: (
                    <GameControllerIcon
                        aria-hidden
                        className="size-6 shrink-0"
                    />
                ),
                label: 'Igra',
                value: 'igra',
            },
            {
                nodeId: 'profile-security',
                icon: <GameLockIcon aria-hidden className="size-6 shrink-0" />,
                label: 'Sigurnost',
                value: 'sigurnost',
            },
            {
                nodeId: 'profile-sound',
                icon: (
                    <GameSpeakerIcon aria-hidden className="size-6 shrink-0" />
                ),
                label: 'Zvuk',
                value: 'zvuk',
            },
        ],
    },
];

export const overviewNavItems = overviewNavGroups.flatMap((g) => g.items);
