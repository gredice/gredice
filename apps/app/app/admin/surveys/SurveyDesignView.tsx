import type { getSurveyAdminDetails } from '@gredice/storage';
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
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { publishSurveyVersionAction } from './actions';
import { SurveyDefinitionForm } from './SurveyDefinitionForm';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';
import { surveyStatusColor, surveyStatusLabel } from './surveyPresentation';

type SurveyDetails = NonNullable<
    Awaited<ReturnType<typeof getSurveyAdminDetails>>
>;

export function SurveyDesignView({ details }: { details: SurveyDetails }) {
    const { survey } = details;

    return (
        <SurveyWorkspaceShell survey={survey} view="design">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader>
                        <CardTitle>Verzije i pitanja</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        <ul className="divide-y">
                            {details.questionGroups.map(
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
                                                            (question) => (
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
                                                    color={surveyStatusColor(
                                                        version.status,
                                                    )}
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    {surveyStatusLabel(
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
                                                {version.status === 'draft' ? (
                                                    <form
                                                        action={
                                                            publishSurveyVersionAction
                                                        }
                                                    >
                                                        <input
                                                            name="surveyId"
                                                            type="hidden"
                                                            value={survey.id}
                                                        />
                                                        <input
                                                            name="versionId"
                                                            type="hidden"
                                                            value={version.id}
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
                            surveyId={survey.id}
                        />
                    </CardContent>
                </Card>
            </div>
        </SurveyWorkspaceShell>
    );
}
