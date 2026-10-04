import type { getSurveyWorkspaceAdminDetails } from '@gredice/storage';
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
import { KnownPages } from '../../../src/KnownPages';
import { publishSurveyVersionAction } from './actions';
import { SurveyDefinitionForm } from './SurveyDefinitionForm';
import { SurveyVersionPreview } from './SurveyVersionPreview';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';
import { surveyVersionToFormValues } from './surveyDefinitionFormModel';
import { surveyStatusColor, surveyStatusLabel } from './surveyPresentation';

type SurveyDetails = NonNullable<
    Awaited<ReturnType<typeof getSurveyWorkspaceAdminDetails>>
>;
type SurveyQuestionGroup = SurveyDetails['questionGroups'][number];

export function SurveyDesignView({
    details,
    editGroup,
    previewGroup,
    sourceGroup,
}: {
    details: SurveyDetails;
    editGroup: SurveyQuestionGroup | null;
    previewGroup: SurveyQuestionGroup | null;
    sourceGroup: SurveyQuestionGroup | null;
}) {
    const { survey } = details;
    const formGroup = editGroup ?? sourceGroup;
    const formValues = formGroup
        ? surveyVersionToFormValues({
              category: survey.category,
              key: survey.key,
              questions: formGroup.questions,
              version: formGroup.version,
          })
        : undefined;

    return (
        <SurveyWorkspaceShell survey={survey} view="design">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,34rem)]">
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
                                                    {`v${version.versionNumber} · ${version.title}`}
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

                                            <Stack
                                                spacing={2}
                                                className="min-w-0 lg:max-w-[26rem] lg:items-end"
                                            >
                                                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 lg:justify-end">
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
                                                </div>
                                                <div className="flex flex-wrap gap-2 lg:justify-end">
                                                    <Button
                                                        href={KnownPages.SurveyDesignPreview(
                                                            survey.id,
                                                            version.id,
                                                        )}
                                                        size="xs"
                                                        variant="outlined"
                                                    >
                                                        Pregled
                                                    </Button>
                                                    <Button
                                                        href={KnownPages.SurveyDesignCopy(
                                                            survey.id,
                                                            version.id,
                                                        )}
                                                        size="xs"
                                                        variant="outlined"
                                                    >
                                                        Nova iz ove
                                                    </Button>
                                                    {version.status ===
                                                    'draft' ? (
                                                        <>
                                                            <Button
                                                                href={KnownPages.SurveyDesignEdit(
                                                                    survey.id,
                                                                    version.id,
                                                                )}
                                                                size="xs"
                                                                variant="outlined"
                                                            >
                                                                Uredi nacrt
                                                            </Button>
                                                            <form
                                                                action={
                                                                    publishSurveyVersionAction
                                                                }
                                                            >
                                                                <input
                                                                    name="surveyId"
                                                                    type="hidden"
                                                                    value={
                                                                        survey.id
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
                                                                    size="xs"
                                                                >
                                                                    Objavi
                                                                </Button>
                                                            </form>
                                                        </>
                                                    ) : null}
                                                </div>
                                            </Stack>
                                        </div>
                                    </li>
                                ),
                            )}
                        </ul>
                    </CardOverflow>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {previewGroup
                                ? `Pregled v${previewGroup.version.versionNumber}`
                                : editGroup
                                  ? `Uredi nacrt v${editGroup.version.versionNumber}`
                                  : sourceGroup
                                    ? `Nova verzija iz v${sourceGroup.version.versionNumber}`
                                    : 'Nova verzija'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {previewGroup ? (
                            <SurveyVersionPreview
                                questions={previewGroup.questions}
                                survey={survey}
                                version={previewGroup.version}
                            />
                        ) : editGroup ? (
                            <SurveyDefinitionForm
                                initialValues={formValues}
                                key={editGroup.version.id}
                                mode="edit-draft"
                                surveyId={survey.id}
                                versionId={editGroup.version.id}
                            />
                        ) : (
                            <Stack spacing={3}>
                                {sourceGroup ? (
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        Sadržaj je kopiran iz v
                                        {sourceGroup.version.versionNumber}.
                                        Spremanje će stvoriti novi nacrt, a
                                        izvor ostaje nepromijenjen.
                                    </Typography>
                                ) : null}
                                <SurveyDefinitionForm
                                    initialValues={formValues}
                                    key={
                                        sourceGroup?.version.id ??
                                        'blank-version'
                                    }
                                    mode="create-version"
                                    sourceVersionId={sourceGroup?.version.id}
                                    surveyId={survey.id}
                                />
                            </Stack>
                        )}
                    </CardContent>
                </Card>
            </div>
        </SurveyWorkspaceShell>
    );
}
