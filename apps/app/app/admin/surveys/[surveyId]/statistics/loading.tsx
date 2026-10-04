import { Card, CardContent } from '@gredice/ui/Card';
import { Skeleton } from '@gredice/ui/Skeleton';
import { Stack } from '@gredice/ui/Stack';

export default function SurveyStatisticsLoading() {
    return (
        <Stack
            aria-label="Učitavanje statistike ankete"
            aria-live="polite"
            role="status"
            spacing={4}
        >
            <Skeleton className="h-8 w-64" />
            <Card>
                <CardContent noHeader>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {[
                            'version',
                            'source',
                            'account',
                            'user',
                            'month',
                            'context',
                        ].map((field) => (
                            <Skeleton
                                key={`survey-filter-${field}`}
                                className="h-10"
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    'assigned',
                    'opened',
                    'started',
                    'submitted',
                    'start-rate',
                    'completion-rate',
                    'response-rate',
                    'duration',
                ].map((metric) => (
                    <Skeleton
                        key={`survey-summary-${metric}`}
                        className="h-32"
                    />
                ))}
            </div>
            <Skeleton className="h-96" />
            <Skeleton className="h-80" />
        </Stack>
    );
}
