import type { SurveyNumericQuestionStatistic } from '@gredice/storage';
import { Alert } from '@gredice/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { Warning } from '@gredice/ui/icons';
import { Progress } from '@gredice/ui/Progress';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import {
    formatSurveyAnalyticsNumber,
    formatSurveyAnalyticsRate,
} from './surveyAnalyticsPresentation';

export function SurveyQuestionStatisticsCard({
    question,
}: {
    question: SurveyNumericQuestionStatistic;
}) {
    return (
        <Card>
            <CardHeader>
                <Row spacing={2} className="flex-wrap">
                    <Chip>v{question.versionNumber}</Chip>
                    <Chip color="neutral" variant="soft">
                        {question.versionTitle}
                    </Chip>
                </Row>
                <CardTitle id={`survey-question-stat-${question.questionId}`}>
                    {question.title}
                </CardTitle>
                <Typography level="body3" className="text-muted-foreground">
                    Ključ {question.questionKey} · ljestvica {question.minimum}–
                    {question.maximum}
                </Typography>
            </CardHeader>
            <CardContent>
                <Stack spacing={4}>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stack spacing={0}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Odgovora
                            </Typography>
                            <Typography level="h4" className="tabular-nums">
                                {question.responseCount.toLocaleString('hr-HR')}
                            </Typography>
                        </Stack>
                        <Stack spacing={0}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Preskočeno / bez vrijednosti
                            </Typography>
                            <Typography level="h4" className="tabular-nums">
                                {question.skippedCount.toLocaleString('hr-HR')}
                            </Typography>
                        </Stack>
                        <Stack spacing={0}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Prosjek
                            </Typography>
                            <Typography level="h4" className="tabular-nums">
                                {formatSurveyAnalyticsNumber(question.average)}
                            </Typography>
                        </Stack>
                        <Stack spacing={0}>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                Medijan
                            </Typography>
                            <Typography level="h4" className="tabular-nums">
                                {formatSurveyAnalyticsNumber(question.median)}
                            </Typography>
                        </Stack>
                    </div>

                    {question.invalidCount > 0 ? (
                        <Alert color="warning" startDecorator={<Warning />}>
                            {question.invalidCount.toLocaleString('hr-HR')}{' '}
                            numeričkih odgovora je izvan ljestvice ove verzije i
                            isključeno iz izračuna.
                        </Alert>
                    ) : null}

                    <Stack spacing={2}>
                        {question.distribution.map((point) => (
                            <div
                                key={point.value}
                                className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2"
                            >
                                <Typography
                                    semiBold
                                    className="text-right tabular-nums"
                                >
                                    {point.value}
                                </Typography>
                                <Progress
                                    aria-label={`Ocjena ${
                                        point.value
                                    }: ${point.count.toLocaleString(
                                        'hr-HR',
                                    )} odgovora, ${formatSurveyAnalyticsRate(
                                        point.percentage,
                                    )}`}
                                    value={point.percentage * 100}
                                />
                                <Typography
                                    level="body3"
                                    className="min-w-24 text-right tabular-nums text-muted-foreground"
                                >
                                    {point.count.toLocaleString('hr-HR')} ·{' '}
                                    {formatSurveyAnalyticsRate(
                                        point.percentage,
                                    )}
                                </Typography>
                            </div>
                        ))}
                    </Stack>

                    <Typography level="body3" className="text-muted-foreground">
                        Postoci distribucije koriste{' '}
                        {question.answeredCount.toLocaleString('hr-HR')}{' '}
                        valjanih numeričkih odgovora kao nazivnik.
                    </Typography>
                </Stack>
            </CardContent>
        </Card>
    );
}
