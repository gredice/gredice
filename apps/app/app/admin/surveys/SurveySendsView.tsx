import type {
    getSurveyWorkspaceAdminDetails,
    listSurveyTargetUsers,
} from '@gredice/storage';
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
import { SurveySendPanel } from './SurveySendPanel';
import { SurveyWorkspaceShell } from './SurveyWorkspaceShell';
import { surveyStatusColor, surveyStatusLabel } from './surveyPresentation';

type SurveyDetails = NonNullable<
    Awaited<ReturnType<typeof getSurveyWorkspaceAdminDetails>>
>;
type SurveyTargetUsers = Awaited<ReturnType<typeof listSurveyTargetUsers>>;

export function SurveySendsView({
    details,
    targetUsers,
}: {
    details: SurveyDetails;
    targetUsers: SurveyTargetUsers;
}) {
    const { survey } = details;

    return (
        <SurveyWorkspaceShell survey={survey} view="sends">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader>
                        <CardTitle>Povijest slanja</CardTitle>
                    </CardHeader>
                    <CardOverflow>
                        {details.sends.length === 0 ? (
                            <div className="p-4">
                                <NoDataPlaceholder>
                                    Nema slanja
                                </NoDataPlaceholder>
                            </div>
                        ) : (
                            <ul className="divide-y">
                                {details.sends.map((send) => (
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
                                                    color={surveyStatusColor(
                                                        send.status,
                                                    )}
                                                    size="sm"
                                                    variant="soft"
                                                >
                                                    {surveyStatusLabel(
                                                        send.status,
                                                    )}
                                                </Chip>
                                                <Typography
                                                    component="span"
                                                    level="body3"
                                                    className="whitespace-nowrap text-muted-foreground"
                                                >
                                                    Dodjele:{' '}
                                                    {send.assignedCount}
                                                </Typography>
                                                <Typography
                                                    component="span"
                                                    level="body3"
                                                    className="whitespace-nowrap text-muted-foreground"
                                                >
                                                    Duplikati:{' '}
                                                    {send.skippedDuplicateCount}
                                                </Typography>
                                                <Typography
                                                    component="span"
                                                    level="body3"
                                                    className="whitespace-nowrap text-muted-foreground"
                                                >
                                                    Kreirano:{' '}
                                                    <LocalDateTime>
                                                        {send.createdAt}
                                                    </LocalDateTime>
                                                </Typography>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardOverflow>
                </Card>

                <Stack spacing={4}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Ručno slanje</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <SurveySendPanel
                                survey={{
                                    activeVersionId: survey.activeVersionId,
                                    id: survey.id,
                                    key: survey.key,
                                    title: survey.title,
                                }}
                                targetUsers={targetUsers}
                            />
                        </CardContent>
                    </Card>
                </Stack>
            </div>
        </SurveyWorkspaceShell>
    );
}
