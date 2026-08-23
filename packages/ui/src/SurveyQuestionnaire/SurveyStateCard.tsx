import { Button } from '../Button';
import { Card, CardContent, CardHeader, CardTitle } from '../Card';
import { Stack } from '../Stack';
import { Typography } from '../Typography';

export function SurveyStateCard({
    backHref,
    backLabel = 'Natrag',
    description,
    title,
}: {
    backHref?: string;
    backLabel?: string;
    description: string;
    title: string;
}) {
    return (
        <Card className="mx-auto max-w-lg bg-background">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <Stack spacing={4}>
                    <Typography className="text-muted-foreground">
                        {description}
                    </Typography>
                    {backHref ? (
                        <Button href={backHref} variant="outlined">
                            {backLabel}
                        </Button>
                    ) : null}
                </Stack>
            </CardContent>
        </Card>
    );
}
