import type { listSurveysAdmin } from '@gredice/storage';
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
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';
import { seedDeliverySatisfactionSurveyAction } from './actions';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';
import { surveyStatusColor, surveyStatusLabel } from './surveyPresentation';
import {
    filterSurveyWorkspaceItems,
    firstSurveyQueryParam,
    normalizeSurveyWorkspaceFilters,
    type SurveyWorkspaceSearchParams,
} from './surveyWorkspaceQuery';

type SurveyList = Awaited<ReturnType<typeof listSurveysAdmin>>;

export function SurveyIndexView({
    params,
    surveys,
}: {
    params: SurveyWorkspaceSearchParams;
    surveys: SurveyList;
}) {
    const { category, query, status } = normalizeSurveyWorkspaceFilters(params);
    const filteredSurveys = filterSurveyWorkspaceItems(surveys, params);
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
        <SurveyWorkspaceShell
            view="index"
            actions={
                <Row spacing={2} className="flex-wrap">
                    <Button href={KnownPages.SurveyCreate}>Nova anketa</Button>
                    <form action={seedDeliverySatisfactionSurveyAction}>
                        <input name="publish" type="hidden" value="true" />
                        <Button type="submit" variant="outlined">
                            Pripremi anketu dostave
                        </Button>
                    </form>
                </Row>
            }
        >
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
                <CardContent>
                    <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto] md:items-end">
                        <label className="space-y-1">
                            <span className="block text-sm font-medium text-foreground">
                                Pretraži
                            </span>
                            <input
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                                defaultValue={
                                    firstSurveyQueryParam(params.q) ?? ''
                                }
                                name="q"
                                placeholder="Naziv, ključ ili opis"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="block text-sm font-medium text-foreground">
                                Status
                            </span>
                            <select
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                                defaultValue={status}
                                name="status"
                            >
                                <option value="">Svi statusi</option>
                                <option value="draft">Nacrt</option>
                                <option value="published">Objavljeno</option>
                                <option value="archived">Arhivirano</option>
                            </select>
                        </label>
                        <label className="space-y-1">
                            <span className="block text-sm font-medium text-foreground">
                                Kategorija
                            </span>
                            <input
                                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30"
                                defaultValue={
                                    firstSurveyQueryParam(params.category) ?? ''
                                }
                                name="category"
                                placeholder="npr. delivery"
                            />
                        </label>
                        <Button type="submit" variant="outlined">
                            Filtriraj
                        </Button>
                    </form>
                    {query || status || category ? (
                        <Typography
                            level="body3"
                            className="mt-3 text-muted-foreground"
                        >
                            Prikazano {filteredSurveys.length} od{' '}
                            {surveys.length} anketa.{' '}
                            <Link
                                href={KnownPages.Surveys}
                                className="font-medium text-primary hover:underline"
                            >
                                Očisti filtre
                            </Link>
                        </Typography>
                    ) : null}
                </CardContent>
                <CardOverflow>
                    {filteredSurveys.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                {surveys.length === 0
                                    ? 'Nema anketa'
                                    : 'Nema anketa za odabrane filtre'}
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {filteredSurveys.map((item) => (
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
                                                color={surveyStatusColor(
                                                    item.survey.status,
                                                )}
                                                size="sm"
                                                variant="soft"
                                            >
                                                {surveyStatusLabel(
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
                                                href={KnownPages.Survey(
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
        </SurveyWorkspaceShell>
    );
}
