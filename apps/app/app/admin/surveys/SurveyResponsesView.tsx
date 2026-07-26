import type {
    getSurveyAdminDetails,
    getSurveyResultsAdmin,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import {
    Card,
    CardContent,
    CardHeader,
    CardOverflow,
    CardTitle,
} from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';

type SurveyDetails = NonNullable<
    Awaited<ReturnType<typeof getSurveyAdminDetails>>
>;
type SurveyResults = Awaited<ReturnType<typeof getSurveyResultsAdmin>>;
type SurveyAnswer =
    NonNullable<SurveyResults>['responses'][number]['answers'][number];

function answerValue(answer: SurveyAnswer) {
    if (answer.skipped) return 'Preskočeno';
    if (answer.numericValue !== null) return answer.numericValue.toString();
    if (answer.textValue) return answer.textValue;
    if (answer.contactValue) {
        const fields = [
            answer.contactValue.firstName,
            answer.contactValue.lastName,
            answer.contactValue.phone,
            answer.contactValue.email,
        ].filter(Boolean);
        return fields.join(', ') || 'Kontakt podaci';
    }
    return 'Bez odgovora';
}

function numericSummary(value: number | null) {
    return value === null ? '-' : value.toFixed(2);
}

export function SurveyResponsesView({
    details,
    monthKey,
    results,
}: {
    details: SurveyDetails;
    monthKey?: string;
    results: SurveyResults;
}) {
    const { survey } = details;

    return (
        <SurveyWorkspaceShell survey={survey} view="responses">
            <Card>
                <CardHeader>
                    <CardTitle>Rezultati</CardTitle>
                </CardHeader>
                <CardContent>
                    <form className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                        <input
                            name="surveyId"
                            type="hidden"
                            value={survey.id}
                        />
                        <label className="space-y-1">
                            <span className="block text-sm font-medium text-foreground">
                                Mjesec dostave
                            </span>
                            <input
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                                name="monthKey"
                                placeholder="2026-06"
                                defaultValue={monthKey ?? ''}
                            />
                        </label>
                        <Button type="submit" variant="outlined">
                            Filtriraj
                        </Button>
                    </form>

                    <Stack spacing={4}>
                        {results?.numericAggregates.length ? (
                            <div className="grid gap-3 md:grid-cols-2">
                                {results.numericAggregates.map((aggregate) => (
                                    <div
                                        key={aggregate.questionId}
                                        className="rounded-md border p-3"
                                    >
                                        <Typography semiBold>
                                            {aggregate.title}
                                        </Typography>
                                        <Typography
                                            level="body2"
                                            className="text-muted-foreground"
                                        >
                                            {aggregate.count} odgovora,{' '}
                                            {aggregate.unansweredCount}{' '}
                                            preskočeno
                                        </Typography>
                                        <Row
                                            spacing={3}
                                            className="mt-2 flex-wrap"
                                        >
                                            <Chip>
                                                Prosjek{' '}
                                                {numericSummary(
                                                    aggregate.average,
                                                )}
                                            </Chip>
                                            <Chip>
                                                Medijan{' '}
                                                {numericSummary(
                                                    aggregate.median,
                                                )}
                                            </Chip>
                                        </Row>
                                        <Typography
                                            level="body3"
                                            className="mt-2 text-muted-foreground"
                                        >
                                            Distribucija:{' '}
                                            {JSON.stringify(
                                                aggregate.distribution,
                                            )}
                                        </Typography>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <NoDataPlaceholder>
                                Nema numeričkih rezultata
                            </NoDataPlaceholder>
                        )}

                        <CardOverflow>
                            {results?.responses.length ? (
                                <ul className="divide-y">
                                    {results.responses.map((response) => (
                                        <li
                                            key={response.response.id}
                                            className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                        >
                                            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.2fr)] lg:items-start">
                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0"
                                                >
                                                    <Typography
                                                        semiBold
                                                        className="min-w-0 break-words"
                                                    >
                                                        Predano:{' '}
                                                        <LocalDateTime>
                                                            {
                                                                response
                                                                    .response
                                                                    .submittedAt
                                                            }
                                                        </LocalDateTime>
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        className="min-w-0 break-words text-muted-foreground"
                                                    >
                                                        Račun:{' '}
                                                        {response.assignment
                                                            ?.accountId ??
                                                            response.response
                                                                .accountId ??
                                                            '-'}
                                                    </Typography>
                                                    <Typography
                                                        level="body3"
                                                        className="min-w-0 break-all text-muted-foreground"
                                                    >
                                                        Kontekst:{' '}
                                                        <code>
                                                            {response.assignment
                                                                ?.context
                                                                .monthKey ??
                                                                response
                                                                    .assignment
                                                                    ?.contextKey ??
                                                                '-'}
                                                        </code>
                                                    </Typography>
                                                </Stack>

                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0 lg:items-end lg:text-right"
                                                >
                                                    <Typography
                                                        level="body3"
                                                        semiBold
                                                        className="text-muted-foreground"
                                                    >
                                                        Odgovori
                                                    </Typography>
                                                    <Stack
                                                        spacing={1}
                                                        className="min-w-0 lg:items-end"
                                                    >
                                                        {response.answers.map(
                                                            (answer) => (
                                                                <Typography
                                                                    key={
                                                                        answer.id
                                                                    }
                                                                    level="body3"
                                                                    className="min-w-0 break-words"
                                                                >
                                                                    <strong>
                                                                        {
                                                                            answer.questionKey
                                                                        }
                                                                        :
                                                                    </strong>{' '}
                                                                    {answerValue(
                                                                        answer,
                                                                    )}
                                                                </Typography>
                                                            ),
                                                        )}
                                                    </Stack>
                                                </Stack>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="p-4">
                                    <NoDataPlaceholder>
                                        Nema odgovora
                                    </NoDataPlaceholder>
                                </div>
                            )}
                        </CardOverflow>
                    </Stack>
                </CardContent>
            </Card>
        </SurveyWorkspaceShell>
    );
}
