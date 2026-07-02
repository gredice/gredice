import {
    getSurveyAdminDetails,
    getSurveyResultsAdmin,
    listSurveysAdmin,
    listSurveyTargetUsers,
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
import Link from 'next/link';
import { AdminPageHeader } from '../../../components/admin/navigation';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';
import { KnownPages } from '../../../src/KnownPages';
import {
    archiveSurveyAction,
    publishSurveyVersionAction,
    seedDeliverySatisfactionSurveyAction,
} from './actions';
import { SurveyDefinitionForm } from './SurveyDefinitionForm';
import { SurveySendPanel } from './SurveySendPanel';

export const dynamic = 'force-dynamic';

type SearchParams = {
    monthKey?: string | string[];
    surveyId?: string | string[];
};

type SurveyResults = Awaited<ReturnType<typeof getSurveyResultsAdmin>>;
type SurveyAnswer =
    NonNullable<SurveyResults>['responses'][number]['answers'][number];

function firstParam(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
}

function statusLabel(status: string) {
    return (
        {
            archived: 'Arhivirano',
            draft: 'Nacrt',
            expired: 'Isteklo',
            pending: 'Čeka',
            published: 'Objavljeno',
            sent: 'Poslano',
            started: 'Započeto',
            submitted: 'Predano',
        }[status] ?? status
    );
}

function statusColor(
    status: string,
): 'success' | 'warning' | 'neutral' | 'primary' {
    if (status === 'published' || status === 'submitted' || status === 'sent') {
        return 'success';
    }
    if (status === 'draft' || status === 'pending' || status === 'started') {
        return 'warning';
    }
    if (status === 'archived' || status === 'expired') {
        return 'neutral';
    }
    return 'primary';
}

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

function buildSurveyHref(surveyId: string, monthKey?: string) {
    const params = new URLSearchParams({ surveyId });
    if (monthKey) {
        params.set('monthKey', monthKey);
    }
    return `${KnownPages.Surveys}?${params.toString()}`;
}

export default async function SurveysPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    await auth(['admin']);

    const params = await searchParams;
    const surveys = await listSurveysAdmin();
    const selectedSurveyId =
        firstParam(params.surveyId) ?? surveys[0]?.survey.id ?? null;
    const monthKey = firstParam(params.monthKey)?.trim() || undefined;
    const [selectedDetails, selectedResults, targetUsers] = await Promise.all([
        selectedSurveyId ? getSurveyAdminDetails(selectedSurveyId) : null,
        selectedSurveyId
            ? getSurveyResultsAdmin({
                  surveyId: selectedSurveyId,
                  monthKey,
              })
            : null,
        listSurveyTargetUsers(),
    ]);
    const selectedSurvey = selectedDetails?.survey ?? null;
    const publishedCount = surveys.filter(
        (item) => item.survey.status === 'published',
    ).length;
    const assignmentCount = surveys.reduce(
        (total, item) => total + item.assignmentCount,
        0,
    );
    const responseCount = surveys.reduce(
        (total, item) => total + item.responseCount,
        0,
    );

    return (
        <Stack spacing={5}>
            <AdminPageHeader
                heading="Ankete"
                actions={
                    <form action={seedDeliverySatisfactionSurveyAction}>
                        <input name="publish" type="hidden" value="true" />
                        <Button type="submit" variant="outlined">
                            Pripremi anketu dostave
                        </Button>
                    </form>
                }
            />

            <Stack spacing={1}>
                <Typography level="h4" component="h1">
                    Ankete
                </Typography>
                <Typography level="body2" className="text-muted-foreground">
                    Definicije, verzije, slanja i rezultati za ankete unutar
                    Gredica.
                </Typography>
            </Stack>

            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Definicije
                        </Typography>
                        <Typography level="h4">{surveys.length}</Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Objavljene
                        </Typography>
                        <Typography level="h4">{publishedCount}</Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Dodjele
                        </Typography>
                        <Typography level="h4">{assignmentCount}</Typography>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent>
                        <Typography level="body3" secondary>
                            Odgovori
                        </Typography>
                        <Typography level="h4">{responseCount}</Typography>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Definicije anketa</CardTitle>
                </CardHeader>
                <CardOverflow>
                    {surveys.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>Nema anketa</NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {surveys.map((item) => (
                                <li
                                    key={item.survey.id}
                                    className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                >
                                    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <Stack spacing={1} className="min-w-0">
                                            <Typography
                                                semiBold
                                                className="min-w-0 break-words"
                                            >
                                                {item.survey.title}
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                className="min-w-0 break-all text-muted-foreground"
                                            >
                                                Ključ:{' '}
                                                <code>{item.survey.key}</code>
                                            </Typography>
                                            {item.survey.description ? (
                                                <Typography
                                                    level="body3"
                                                    className="max-w-md text-muted-foreground"
                                                >
                                                    {item.survey.description}
                                                </Typography>
                                            ) : null}
                                        </Stack>

                                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:max-w-[32rem] lg:justify-end lg:text-right">
                                            <Chip
                                                color={statusColor(
                                                    item.survey.status,
                                                )}
                                                size="sm"
                                                variant="soft"
                                            >
                                                {statusLabel(
                                                    item.survey.status,
                                                )}
                                            </Chip>
                                            <Typography
                                                component="span"
                                                level="body3"
                                                className="whitespace-nowrap text-muted-foreground"
                                            >
                                                Verzije: {item.versions.length}
                                            </Typography>
                                            <Typography
                                                component="span"
                                                level="body3"
                                                className="whitespace-nowrap text-muted-foreground"
                                            >
                                                Dodjele: {item.assignmentCount}
                                            </Typography>
                                            <Typography
                                                component="span"
                                                level="body3"
                                                className="whitespace-nowrap text-muted-foreground"
                                            >
                                                Odgovori: {item.responseCount}
                                            </Typography>
                                            <Typography
                                                component="span"
                                                level="body3"
                                                className="whitespace-nowrap text-muted-foreground"
                                            >
                                                Ažurirano:{' '}
                                                <LocalDateTime>
                                                    {item.survey.updatedAt}
                                                </LocalDateTime>
                                            </Typography>
                                            <Link
                                                href={buildSurveyHref(
                                                    item.survey.id,
                                                )}
                                                prefetch={false}
                                                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                                            >
                                                Otvori
                                            </Link>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardOverflow>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader>
                        <CardTitle>Nova anketa</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <SurveyDefinitionForm />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Upute za objavu</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Stack spacing={2}>
                            <Typography level="body2">
                                Objavljena verzija se ne uređuje izravno.
                                Promjene idu kroz novu verziju kako bi stari
                                odgovori ostali vezani uz pitanje koje je
                                korisnik vidio.
                            </Typography>
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Priprema dostavne ankete stvara trenutni set
                                pitanja i objavljuje ga ako još ne postoji.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </div>

            {selectedSurvey && selectedDetails ? (
                <>
                    <Stack spacing={1}>
                        <Row className="items-center justify-between gap-3">
                            <Stack spacing={1}>
                                <Typography level="h5" component="h2">
                                    {selectedSurvey.title}
                                </Typography>
                                <Typography
                                    level="body2"
                                    className="text-muted-foreground"
                                >
                                    {selectedSurvey.key}
                                </Typography>
                            </Stack>
                            <Chip
                                color={statusColor(selectedSurvey.status)}
                                variant="soft"
                            >
                                {statusLabel(selectedSurvey.status)}
                            </Chip>
                        </Row>
                    </Stack>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                        <Card>
                            <CardHeader>
                                <CardTitle>Verzije i pitanja</CardTitle>
                            </CardHeader>
                            <CardOverflow>
                                <ul className="divide-y">
                                    {selectedDetails.questionGroups.map(
                                        ({ questions, version }) => (
                                            <li
                                                key={version.id}
                                                className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                            >
                                                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                    <Stack
                                                        spacing={2}
                                                        className="min-w-0"
                                                    >
                                                        <Typography
                                                            semiBold
                                                            className="min-w-0 break-words"
                                                        >
                                                            {`v${version.versionNumber}`}
                                                        </Typography>
                                                        <Stack spacing={1}>
                                                            <Typography
                                                                level="body3"
                                                                semiBold
                                                                className="text-muted-foreground"
                                                            >
                                                                Pitanja
                                                            </Typography>
                                                            <Stack spacing={1}>
                                                                {questions.map(
                                                                    (
                                                                        question,
                                                                    ) => (
                                                                        <Typography
                                                                            key={
                                                                                question.id
                                                                            }
                                                                            level="body3"
                                                                            className="min-w-0 break-words"
                                                                        >
                                                                            {`${question.sortOrder}. ${question.title} (${question.type})`}
                                                                        </Typography>
                                                                    ),
                                                                )}
                                                            </Stack>
                                                        </Stack>
                                                    </Stack>

                                                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:max-w-[24rem] lg:justify-end lg:text-right">
                                                        <Chip
                                                            color={statusColor(
                                                                version.status,
                                                            )}
                                                            size="sm"
                                                            variant="soft"
                                                        >
                                                            {statusLabel(
                                                                version.status,
                                                            )}
                                                        </Chip>
                                                        {version.publishedAt ? (
                                                            <Typography
                                                                component="span"
                                                                level="body3"
                                                                className="whitespace-nowrap text-muted-foreground"
                                                            >
                                                                Objavljeno:{' '}
                                                                <LocalDateTime>
                                                                    {
                                                                        version.publishedAt
                                                                    }
                                                                </LocalDateTime>
                                                            </Typography>
                                                        ) : (
                                                            <NoDataPlaceholder>
                                                                Nije objavljeno
                                                            </NoDataPlaceholder>
                                                        )}
                                                        {version.status ===
                                                        'draft' ? (
                                                            <form
                                                                action={
                                                                    publishSurveyVersionAction
                                                                }
                                                            >
                                                                <input
                                                                    name="surveyId"
                                                                    type="hidden"
                                                                    value={
                                                                        selectedSurvey.id
                                                                    }
                                                                />
                                                                <input
                                                                    name="versionId"
                                                                    type="hidden"
                                                                    value={
                                                                        version.id
                                                                    }
                                                                />
                                                                <Button
                                                                    type="submit"
                                                                    size="sm"
                                                                >
                                                                    Objavi
                                                                </Button>
                                                            </form>
                                                        ) : (
                                                            <NoDataPlaceholder>
                                                                -
                                                            </NoDataPlaceholder>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            </CardOverflow>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Nova verzija</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <SurveyDefinitionForm
                                    mode="version"
                                    surveyId={selectedSurvey.id}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                        <Card>
                            <CardHeader>
                                <CardTitle>Rezultati</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form className="mb-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                                    <input
                                        name="surveyId"
                                        type="hidden"
                                        value={selectedSurvey.id}
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
                                    {selectedResults?.numericAggregates
                                        .length ? (
                                        <div className="grid gap-3 md:grid-cols-2">
                                            {selectedResults.numericAggregates.map(
                                                (aggregate) => (
                                                    <div
                                                        key={
                                                            aggregate.questionId
                                                        }
                                                        className="rounded-md border p-3"
                                                    >
                                                        <Typography semiBold>
                                                            {aggregate.title}
                                                        </Typography>
                                                        <Typography
                                                            level="body2"
                                                            className="text-muted-foreground"
                                                        >
                                                            {aggregate.count}{' '}
                                                            odgovora,{' '}
                                                            {
                                                                aggregate.unansweredCount
                                                            }{' '}
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
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <NoDataPlaceholder>
                                            Nema numeričkih rezultata
                                        </NoDataPlaceholder>
                                    )}

                                    <CardOverflow>
                                        {selectedResults?.responses.length ? (
                                            <ul className="divide-y">
                                                {selectedResults?.responses.map(
                                                    (response) => (
                                                        <li
                                                            key={
                                                                response
                                                                    .response.id
                                                            }
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
                                                                        {response
                                                                            .assignment
                                                                            ?.accountId ??
                                                                            response
                                                                                .response
                                                                                .accountId ??
                                                                            '-'}
                                                                    </Typography>
                                                                    <Typography
                                                                        level="body3"
                                                                        className="min-w-0 break-all text-muted-foreground"
                                                                    >
                                                                        Kontekst:{' '}
                                                                        <code>
                                                                            {response
                                                                                .assignment
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
                                                                        spacing={
                                                                            1
                                                                        }
                                                                        className="min-w-0 lg:items-end"
                                                                    >
                                                                        {response.answers.map(
                                                                            (
                                                                                answer,
                                                                            ) => (
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
                                                    ),
                                                )}
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

                        <Stack spacing={4}>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Ručno slanje</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <SurveySendPanel
                                        survey={{
                                            activeVersionId:
                                                selectedSurvey.activeVersionId,
                                            id: selectedSurvey.id,
                                            key: selectedSurvey.key,
                                            title: selectedSurvey.title,
                                        }}
                                        targetUsers={targetUsers}
                                    />
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Povijest slanja</CardTitle>
                                </CardHeader>
                                <CardOverflow>
                                    {selectedDetails.sends.length === 0 ? (
                                        <div className="p-4">
                                            <NoDataPlaceholder>
                                                Nema slanja
                                            </NoDataPlaceholder>
                                        </div>
                                    ) : (
                                        <ul className="divide-y">
                                            {selectedDetails.sends.map(
                                                (send) => (
                                                    <li
                                                        key={send.id}
                                                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                                    >
                                                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                                            <Typography
                                                                semiBold
                                                                className="min-w-0 break-words"
                                                            >
                                                                {send.name}
                                                            </Typography>

                                                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:max-w-[24rem] lg:justify-end lg:text-right">
                                                                <Chip
                                                                    color={statusColor(
                                                                        send.status,
                                                                    )}
                                                                    size="sm"
                                                                    variant="soft"
                                                                >
                                                                    {statusLabel(
                                                                        send.status,
                                                                    )}
                                                                </Chip>
                                                                <Typography
                                                                    component="span"
                                                                    level="body3"
                                                                    className="whitespace-nowrap text-muted-foreground"
                                                                >
                                                                    Dodjele:{' '}
                                                                    {
                                                                        send.assignedCount
                                                                    }
                                                                </Typography>
                                                                <Typography
                                                                    component="span"
                                                                    level="body3"
                                                                    className="whitespace-nowrap text-muted-foreground"
                                                                >
                                                                    Duplikati:{' '}
                                                                    {
                                                                        send.skippedDuplicateCount
                                                                    }
                                                                </Typography>
                                                                <Typography
                                                                    component="span"
                                                                    level="body3"
                                                                    className="whitespace-nowrap text-muted-foreground"
                                                                >
                                                                    Kreirano:{' '}
                                                                    <LocalDateTime>
                                                                        {
                                                                            send.createdAt
                                                                        }
                                                                    </LocalDateTime>
                                                                </Typography>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    )}
                                </CardOverflow>
                            </Card>

                            <form action={archiveSurveyAction}>
                                <input
                                    name="surveyId"
                                    type="hidden"
                                    value={selectedSurvey.id}
                                />
                                <Button
                                    type="submit"
                                    color="danger"
                                    variant="outlined"
                                    fullWidth
                                >
                                    Arhiviraj anketu
                                </Button>
                            </form>
                        </Stack>
                    </div>
                </>
            ) : null}
        </Stack>
    );
}
