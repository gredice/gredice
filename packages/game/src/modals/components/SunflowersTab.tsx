import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import Image from 'next/image';
import { useCurrentAccount } from '../../hooks/useCurrentAccount';
import { DailyRewardOverview } from '../../shared-ui/sunflowers/DailyRewardOverview';
import { SunflowersList } from '../../shared-ui/sunflowers/SunflowersList';

export function SunflowersTab() {
    const { data: currentAccount } = useCurrentAccount();

    return (
        <Stack spacing={4}>
            <Typography level="h4" className="hidden md:block">
                🌻 Suncokreti
            </Typography>
            <Stack spacing={1} className="max-h-[calc(100dvh-12rem)]">
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
                <div className="overflow-y-auto max-h-[calc(100dvh-20rem)] md:max-h-[calc(100dvh-24rem)] rounded-lg text-card-foreground bg-card border shadow-sm p-4">
                    <SunflowersList />
                </div>
            </Stack>
        </Stack>
    );
}
