import { Card, CardContent } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Image from 'next/image';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { DailyRewardOverview } from '../../shared-ui/sunflowers/DailyRewardOverview';
import { SunflowerPackagesPanel } from '../../shared-ui/sunflowers/SunflowerPackagesPanel';
import { SunflowersList } from '../../shared-ui/sunflowers/SunflowersList';

export function SunflowersTab() {
    const { data: currentAccount } = useCurrentAccount();

    return (
        <Stack spacing={8}>
            <Typography level="h4" className="hidden md:block">
                🌻 Suncokreti
            </Typography>
            <Stack
                spacing={3}
                className="max-h-[calc(100dvh-12rem)] overflow-y-auto pr-1"
            >
                <div className="relative md:mt-0">
                    <span className="absolute text-5xl -top-12 right-6 hidden md:block">
                        <Image
                            src="https://cdn.gredice.com/sunflower-large.svg"
                            alt="Suncokret"
                            className="size-12"
                            width={48}
                            height={48}
                        />
                    </span>
                    <Card className="relative z-10">
                        <CardContent noHeader>
                            <Typography level="body2">
                                Trenutno imaš{' '}
                                <strong>
                                    {currentAccount?.sunflowers.amount}
                                </strong>{' '}
                                suncokreta za korištenje u svom vrtu.
                            </Typography>
                        </CardContent>
                    </Card>
                </div>
                <Card>
                    <CardContent noHeader>
                        <DailyRewardOverview />
                    </CardContent>
                </Card>
                <SunflowerPackagesPanel />
                <div className="rounded-lg text-card-foreground bg-card border shadow-xs p-4">
                    <SunflowersList />
                </div>
            </Stack>
        </Stack>
    );
}
