import type {
    getSurveyWorkspaceAdminDetails,
    listSurveysAdmin,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../../src/KnownPages';
import { archiveSurveyAction } from './actions';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';
import { surveyStatusColor, surveyStatusLabel } from './surveyPresentation';

type SurveyDetails = NonNullable<
    Awaited<ReturnType<typeof getSurveyWorkspaceAdminDetails>>
>;
type SurveyListItem =
    | Awaited<ReturnType<typeof listSurveysAdmin>>[number]
    | null;

export function SurveyOverviewView({
    details,
    listItem,
}: {
    details: SurveyDetails;
    listItem: SurveyListItem;
}) {
    const { survey } = details;

    return (
        <SurveyWorkspaceShell survey={survey} view="overview">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Stack spacing={4}>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardContent>
                                <Typography level="body3" secondary>
                                    Verzije
                                </Typography>
                                <Typography level="h4">
                                    {details.versions.length}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <Typography level="body3" secondary>
                                    Dodjele
                                </Typography>
                                <Typography level="h4">
                                    {listItem?.assignmentCount ?? 0}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <Typography level="body3" secondary>
                                    Odgovori
                                </Typography>
                                <Typography level="h4">
                                    {listItem?.responseCount ?? 0}
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent>
                                <Typography level="body3" secondary>
                                    Slanja
                                </Typography>
                                <Typography level="h4">
                                    {details.sends.length}
                                </Typography>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>O anketi</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <Row className="flex-wrap items-center">
                                    <Chip
                                        color={surveyStatusColor(survey.status)}
                                        variant="soft"
                                    >
                                        {surveyStatusLabel(survey.status)}
                                    </Chip>
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        Kategorija: {survey.category}
                                    </Typography>
                                </Row>
                                <Typography level="body2">
                                    {survey.description ?? 'Anketa nema opis.'}
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="text-muted-foreground"
                                >
                                    Zadnje ažuriranje:{' '}
                                    <LocalDateTime>
                                        {survey.updatedAt}
                                    </LocalDateTime>
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>

                <Stack spacing={3}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Brze radnje</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Stack spacing={2}>
                                <Button
                                    href={KnownPages.SurveyDesign(survey.id)}
                                    variant="outlined"
                                    fullWidth
                                >
                                    Uredi dizajn i verzije
                                </Button>
                                <Button
                                    href={KnownPages.SurveySends(survey.id)}
                                    variant="outlined"
                                    fullWidth
                                >
                                    Pošalji anketu
                                </Button>
                                <Button
                                    href={KnownPages.SurveyResponses(survey.id)}
                                    variant="outlined"
                                    fullWidth
                                >
                                    Pregledaj odgovore
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                    <form action={archiveSurveyAction}>
                        <input
                            name="surveyId"
                            type="hidden"
                            value={survey.id}
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
        </SurveyWorkspaceShell>
    );
}
