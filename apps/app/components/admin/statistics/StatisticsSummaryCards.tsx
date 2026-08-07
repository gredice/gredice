import { Card, CardOverflow } from '@gredice/ui/Card';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';

export type StatisticsSummaryCard = {
    label: string;
    value: string;
    detail: string;
};

export function StatisticsSummaryCards({
    cards,
}: {
    cards: StatisticsSummaryCard[];
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
                <Card key={card.label}>
                    <CardOverflow>
                        <Stack spacing={2} className="p-4">
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {card.label}
                            </Typography>
                            <Typography level="h2" className="tabular-nums">
                                {card.value}
                            </Typography>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {card.detail}
                            </Typography>
                        </Stack>
                    </CardOverflow>
                </Card>
            ))}
        </div>
    );
}
