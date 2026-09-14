import {
    GameContactIcon,
    GameGardenIcon,
    GameGardenPlanIcon,
    GameLogoutIcon,
    GameMailboxIcon,
    GameProfileIcon,
    GameSeedlingIcon,
    GameSettingsIcon,
} from '@gredice/ui/GameIcons';
import { ExternalLink, Navigate } from '@gredice/ui/icons';

const entries = [
    { label: 'Vrtovi za igru', Icon: GameGardenIcon, submenu: true },
    { label: '2D prikaz vrta', Icon: GameGardenPlanIcon, divider: true },
    { label: 'Profil', Icon: GameProfileIcon },
    { label: 'Obavijesti', Icon: GameMailboxIcon, unread: true },
    { label: 'Postavke', Icon: GameSettingsIcon, divider: true },
    { label: 'Baza biljaka', Icon: GameSeedlingIcon, external: true },
    {
        label: 'Kontaktiraj nas',
        Icon: GameContactIcon,
        external: true,
        divider: true,
    },
    { label: 'Odjava', Icon: GameLogoutIcon },
];

/** Static artwork comparison in the same spacing as the account dropdown. */
export function GameAccountMenuPreview() {
    return (
        <section aria-label="Garden account menu" className="space-y-3">
            <h2 className="text-sm font-semibold">Izbornik vrta</h2>
            <ul className="w-80 max-w-full rounded-md border bg-popover p-4 text-popover-foreground shadow-md">
                {entries.map(
                    ({ label, Icon, submenu, external, unread, divider }) => (
                        <li
                            key={label}
                            className={
                                divider ? 'mb-4 border-b pb-4' : undefined
                            }
                        >
                            <div className="flex items-center gap-3 px-2 py-1.5 text-sm">
                                <Icon aria-hidden className="size-6 shrink-0" />
                                <span>{label}</span>
                                {unread && (
                                    <span className="size-2 rounded-full bg-green-500" />
                                )}
                                {submenu && (
                                    <Navigate
                                        aria-hidden
                                        className="ml-auto size-4"
                                    />
                                )}
                                {external && (
                                    <ExternalLink
                                        aria-hidden
                                        className="ml-auto size-4"
                                    />
                                )}
                            </div>
                        </li>
                    ),
                )}
            </ul>
        </section>
    );
}
