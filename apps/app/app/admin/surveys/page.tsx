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
import { Table } from '@gredice/ui/Table';
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

function statusColor(status: string) {
    if (status === 'published' || status === 'submitted' || status === 'sent') {
        return 'success' as const;
    }
    if (status === 'draft' || status === 'pending' || status === 'started') {
        return 'warning' as const;
    }
    if (status === 'archived' || status === 'expired') {
        return 'neutral' as const;
    }
    return 'primary' as const;
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
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Naziv</Table.Head>
                                <Table.Head>Ključ</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Verzije</Table.Head>
                                <Table.Head>Dodjele</Table.Head>
                                <Table.Head>Odgovori</Table.Head>
                                <Table.Head>Ažurirano</Table.Head>
                                <Table.Head>Detalji</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {surveys.length === 0 ? (
                                <Table.Row>
                                    <Table.Cell colSpan={8}>
                                        <NoDataPlaceholder>
                                            Nema anketa
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            ) : null}
                            {surveys.map((item) => (
                                <Table.Row key={item.survey.id}>
                                    <Table.Cell>
                                        <Stack spacing={1}>
                                            <Typography semiBold>
                                                {item.survey.title}
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
                                    </Table.Cell>
                                    <Table.Cell>
                                        <code>{item.survey.key}</code>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Chip
                                            color={statusColor(
                                                item.survey.status,
                                            )}
                                            size="sm"
                                            variant="soft"
                                        >
                                            {statusLabel(item.survey.status)}
                                        </Chip>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.versions.length}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.assignmentCount}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {item.responseCount}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime>
                                            {item.survey.updatedAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Link
                                            href={buildSurveyHref(
                                                item.survey.id,
                                            )}
                                            prefetch={false}
                                        >
                                            Otvori
                                        </Link>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
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
                                <Table>
                                    <Table.Header>
                                        <Table.Row>
                                            <Table.Head>Verzija</Table.Head>
                                            <Table.Head>Status</Table.Head>
                                            <Table.Head>Objavljeno</Table.Head>
                                            <Table.Head>Pitanja</Table.Head>
                                            <Table.Head>Radnje</Table.Head>
                                        </Table.Row>
                                    </Table.Header>
                                    <Table.Body>
                                        {selectedDetails.questionGroups.map(
                                            ({ questions, version }) => (
                                                <Table.Row key={version.id}>
                                                    <Table.Cell>
                                                        v{version.versionNumber}
                                                    </Table.Cell>
                                                    <Table.Cell>
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
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        {version.publishedAt ? (
                                                            <LocalDateTime>
                                                                {
                                                                    version.publishedAt
                                                                }
                                                            </LocalDateTime>
                                                        ) : (
                                                            <NoDataPlaceholder>
                                                                Nije objavljeno
                                                            </NoDataPlaceholder>
                                                        )}
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <Stack spacing={1}>
                                                            {questions.map(
                                                                (question) => (
                                                                    <Typography
                                                                        key={
                                                                            question.id
                                                                        }
                                                                        level="body3"
                                                                    >
                                                                        {
                                                                            question.sortOrder
                                                                        }
                                                                        .{' '}
                                                                        {
                                                                            question.title
                                                                        }{' '}
                                                                        (
                                                                        {
                                                                            question.type
                                                                        }
                                                                        )
                                                                    </Typography>
                                                                ),
                                                            )}
                                                        </Stack>
                                                    </Table.Cell>
                                                    <Table.Cell>
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
                                                    </Table.Cell>
                                                </Table.Row>
                                            ),
                                        )}
                                    </Table.Body>
                                </Table>
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
                                        <Table>
                                            <Table.Header>
                                                <Table.Row>
                                                    <Table.Head>
                                                        Predano
                                                    </Table.Head>
                                                    <Table.Head>
                                                        Račun
                                                    </Table.Head>
                                                    <Table.Head>
                                                        Kontekst
                                                    </Table.Head>
                                                    <Table.Head>
                                                        Odgovori
                                                    </Table.Head>
                                                </Table.Row>
                                            </Table.Header>
                                            <Table.Body>
                                                {selectedResults?.responses
                                                    .length ? null : (
                                                    <Table.Row>
                                                        <Table.Cell colSpan={4}>
                                                            <NoDataPlaceholder>
                                                                Nema odgovora
                                                            </NoDataPlaceholder>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                )}
                                                {selectedResults?.responses.map(
                                                    (response) => (
                                                        <Table.Row
                                                            key={
                                                                response
                                                                    .response.id
                                                            }
                                                        >
                                                            <Table.Cell>
                                                                <LocalDateTime>
                                                                    {
                                                                        response
                                                                            .response
                                                                            .submittedAt
                                                                    }
                                                                </LocalDateTime>
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                {response
                                                                    .assignment
                                                                    ?.accountId ??
                                                                    response
                                                                        .response
                                                                        .accountId ??
                                                                    '-'}
                                                            </Table.Cell>
                                                            <Table.Cell>
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
                                                            </Table.Cell>
                                                            <Table.Cell>
                                                                <Stack
                                                                    spacing={1}
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
                                                            </Table.Cell>
                                                        </Table.Row>
                                                    ),
                                                )}
                                            </Table.Body>
                                        </Table>
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
                                    <Table>
                                        <Table.Header>
                                            <Table.Row>
                                                <Table.Head>Naziv</Table.Head>
                                                <Table.Head>Status</Table.Head>
                                                <Table.Head>Dodjele</Table.Head>
                                                <Table.Head>
                                                    Duplikati
                                                </Table.Head>
                                                <Table.Head>
                                                    Kreirano
                                                </Table.Head>
                                            </Table.Row>
                                        </Table.Header>
                                        <Table.Body>
                                            {selectedDetails.sends.length ===
                                            0 ? (
                                                <Table.Row>
                                                    <Table.Cell colSpan={5}>
                                                        <NoDataPlaceholder>
                                                            Nema slanja
                                                        </NoDataPlaceholder>
                                                    </Table.Cell>
                                                </Table.Row>
                                            ) : null}
                                            {selectedDetails.sends.map(
                                                (send) => (
                                                    <Table.Row key={send.id}>
                                                        <Table.Cell>
                                                            {send.name}
                                                        </Table.Cell>
                                                        <Table.Cell>
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
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {send.assignedCount}
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            {
                                                                send.skippedDuplicateCount
                                                            }
                                                        </Table.Cell>
                                                        <Table.Cell>
                                                            <LocalDateTime>
                                                                {send.createdAt}
                                                            </LocalDateTime>
                                                        </Table.Cell>
                                                    </Table.Row>
                                                ),
                                            )}
                                        </Table.Body>
                                    </Table>
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
