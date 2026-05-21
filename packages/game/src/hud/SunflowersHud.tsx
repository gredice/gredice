import { useSearchParam } from '@signalco/hooks/useSearchParam';
import {
    Info,
    Navigate,
    ShoppingCart as ShoppingCartIcon,
} from '@signalco/ui-icons';
import { Button } from '@signalco/ui-primitives/Button';
import { Divider } from '@signalco/ui-primitives/Divider';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Popper } from '@signalco/ui-primitives/Popper';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { useCurrentAccount } from '../hooks/useCurrentAccount';
import { useDailyReward } from '../hooks/useDailyReward';
import { useShoppingCart } from '../hooks/useShoppingCart';
import { KnownPages } from '../knownPages';
import { SunflowersList } from '../shared-ui/sunflowers/SunflowersList';
import { formatSunflowers } from '../utils/sunflowerPricing';
import { HudCard } from './components/HudCard';

function DailyRewardInfo() {
    const { data } = useDailyReward();
    if (!data) return null;
    const currentDay = data.current.day >= 7 ? '7+' : data.current.day;
    return (
        <Stack className="p-2">
            <Typography level="body2" bold>
                Dnevna aktivnost
            </Typography>
            <Row justifyContent="space-between">
                <Typography level="body3">{`Danas - dan ${currentDay}`}</Typography>
                <Typography level="body2">+{data.current.amount} 🌻</Typography>
            </Row>
            <Row justifyContent="space-between">
                <Typography level="body3">{`Sutra te čeka`}</Typography>
                <Typography level="body2">+{data.next.amount} 🌻</Typography>
            </Row>
        </Stack>
    );
}

export function SunflowersInfoTooltipContent() {
    return (
        <Stack className="p-4" spacing={2}>
            <Row spacing={2} alignItems="start">
                <Image
                    src="https://cdn.gredice.com/sunflower-large.svg"
                    alt="Suncokret"
                    width={72}
                    height={72}
                    className="size-16 shrink-0"
                />
                <Stack spacing={1}>
                    <Typography level="body2" bold>
                        Što su suncokreti?
                    </Typography>
                    <Typography level="body2">
                        Sakupljaj i koristi suncokrete za uređenje i dekoraciju
                        vrta ili kupnju i brigu o svojim biljkama 🌱
                    </Typography>
                </Stack>
            </Row>
            <Stack spacing={1}>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Stack
                        spacing={0.5}
                        className="rounded-md border bg-muted/40 p-3"
                    >
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Plaćanje
                        </Typography>
                        <Typography level="body1" bold className="tabular-nums">
                            1 € = 1.000 🌻
                        </Typography>
                    </Stack>
                    <Stack
                        spacing={0.5}
                        className="rounded-md border bg-muted/40 p-3"
                    >
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Bonus za kupnju
                        </Typography>
                        <Typography level="body1" bold className="tabular-nums">
                            1 € = 10 🌻
                        </Typography>
                    </Stack>
                </div>
                <Typography level="body3" className="text-muted-foreground">
                    Kod plaćanja suncokretima cijena se računa iz eura i
                    zaokružuje na cijeli broj.
                </Typography>
            </Stack>
            <Button
                variant="solid"
                size="sm"
                href={KnownPages.GrediceSunflowers}
                target="_blank"
                className="self-start"
                endDecorator={<Navigate className="size-5" />}
            >
                Saznaj više
            </Button>
        </Stack>
    );
}

function SunflowersCard({ pendingSunflowers }: { pendingSunflowers: number }) {
    const [, setProfileModalOpen] = useSearchParam('pregled');

    return (
        <Stack>
            <Row
                className="bg-background px-4 py-1"
                justifyContent="space-between"
            >
                <Typography level="body2" bold>
                    Suncokreti
                </Typography>
                <Popper
                    className="w-[min(calc(100vw-2rem),28rem)] border-tertiary border-b-4"
                    trigger={
                        <IconButton title="Što su suncokreti?" variant="plain">
                            <Info className="size-4 shrink-0" />
                        </IconButton>
                    }
                >
                    <SunflowersInfoTooltipContent />
                </Popper>
            </Row>
            <Divider />
            <DailyRewardInfo />
            <Divider />
            <SunflowersList limit={5} pendingSunflowers={pendingSunflowers} />
            <Divider />
            <Stack>
                <Button
                    variant="plain"
                    size="sm"
                    fullWidth
                    className="rounded-t-none"
                    onClick={() => setProfileModalOpen('suncokreti')}
                >
                    Prikaži sve aktivnosti
                </Button>
            </Stack>
        </Stack>
    );
}

function SunflowersAmount() {
    const { data: account, isLoading } = useCurrentAccount();
    const { data: cart } = useShoppingCart();
    const sunflowerCount = account?.sunflowers.amount;
    const pendingSunflowers = cart?.totalSunflowers ?? 0;
    const displayedSunflowerCount =
        typeof sunflowerCount === 'number'
            ? sunflowerCount - pendingSunflowers
            : undefined;

    if (isLoading) {
        return null;
    }

    return (
        <Popper
            className="overflow-hidden border-tertiary border-b-4"
            side="bottom"
            sideOffset={12}
            trigger={
                <Button
                    variant="plain"
                    title="Suncokreti"
                    data-sunflowers-hud-target
                    startDecorator={
                        <Image
                            src="https://cdn.gredice.com/sunflower-large.svg"
                            alt="Suncokret"
                            className="size-6"
                            width={24}
                            height={24}
                        />
                    }
                    className="relative rounded-full px-2 md:min-w-20 justify-between pr-4"
                >
                    <Typography level="body2" className="text-base pl-0.5">
                        {typeof displayedSunflowerCount === 'number'
                            ? formatSunflowers(displayedSunflowerCount)
                            : sunflowerCount}
                    </Typography>
                    {pendingSunflowers > 0 && (
                        <span
                            aria-hidden="true"
                            title={`U košari: ${formatSunflowers(pendingSunflowers)} 🌻`}
                            data-sunflowers-cart-indicator
                            className="pointer-events-none absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-background bg-neutral-100 text-neutral-900 shadow-sm"
                        >
                            <ShoppingCartIcon className="size-[18px] shrink-0" />
                        </span>
                    )}
                </Button>
            }
        >
            <SunflowersCard pendingSunflowers={pendingSunflowers} />
        </Popper>
    );
}

export function SunflowersHud() {
    return (
        <HudCard position="floating" open className="static z-[55]">
            <SunflowersAmount />
        </HudCard>
    );
}
