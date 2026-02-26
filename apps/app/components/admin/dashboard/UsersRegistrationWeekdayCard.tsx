'use client';

import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';

export type WeekdayRegistrationData = {
    label: string;
    count: number;
};

export function UsersRegistrationWeekdayCard({
    data,
}: {
    data: WeekdayRegistrationData[];
}) {
    const maxCount = Math.max(0, ...data.map((item) => item.count));
    const bestDay = data.find(
        (item) => item.count === maxCount && maxCount > 0,
    );

    return (
        <Card>
            <CardOverflow>
                <Stack spacing={2} className="p-4">
                    <Stack spacing={0.5}>
                        <Typography level="body3">
                            Registracije korisnika po danu u tjednu
                        </Typography>
                        <Typography level="h4" semiBold>
                            {bestDay
                                ? `${bestDay.label} (${bestDay.count})`
                                : 'Nema registracija'}
                        </Typography>
                        <Typography
                            level="body3"
                            className="text-muted-foreground"
                        >
                            Najčešći dan registracije u odabranom periodu
                        </Typography>
                    </Stack>
                    <Stack spacing={1}>
                        {data.map((item) => {
                            const widthPercent =
                                maxCount > 0
                                    ? (item.count / maxCount) * 100
                                    : 0;
                            return (
                                <Stack key={item.label} spacing={0.5}>
                                    <Row justifyContent="space-between">
                                        <Typography level="body3">
                                            {item.label}
                                        </Typography>
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            {item.count}
                                        </Typography>
                                    </Row>
                                    <div
                                        className="h-2 w-full rounded-full bg-primary/10"
                                        role="img"
                                        aria-label={`${item.label}: ${item.count}`}
                                    >
                                        <div
                                            className="h-2 rounded-full bg-primary/60"
                                            style={{
                                                width: `${Math.max(widthPercent, item.count > 0 ? 4 : 0)}%`,
                                            }}
                                        />
                                    </div>
                                </Stack>
                            );
                        })}
                    </Stack>
                </Stack>
            </CardOverflow>
        </Card>
    );
}
