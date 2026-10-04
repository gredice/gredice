import { getFeedbacks } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
    await auth(['admin']);
    const feedbacks = await getFeedbacks();

    return (
        <Stack spacing={4}>
            <Row spacing={2}>
                <Chip color="primary">{feedbacks.length}</Chip>
            </Row>
            <Card>
                <CardOverflow>
                    {feedbacks.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Nema povratnih informacija
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
                            {feedbacks.map((feedback) => {
                                const dataSummary =
                                    JSON.stringify(feedback.data) ?? '';

                                return (
                                    <li
                                        key={feedback.id}
                                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                    >
                                        <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <Stack
                                                spacing={1}
                                                className="min-w-0 flex-1"
                                            >
                                                <Typography
                                                    level="body1"
                                                    component="h3"
                                                    semiBold
                                                    className="min-w-0 break-words"
                                                >
                                                    {feedback.topic}
                                                </Typography>
                                                {feedback.comment ? (
                                                    <Typography
                                                        level="body2"
                                                        className="min-w-0 whitespace-pre-wrap break-words"
                                                    >
                                                        {feedback.comment}
                                                    </Typography>
                                                ) : null}
                                            </Stack>
                                            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 md:max-w-[32rem] md:justify-end">
                                                {feedback.score ? (
                                                    <Chip
                                                        color="neutral"
                                                        size="sm"
                                                        variant="outlined"
                                                    >
                                                        Ocijena:{' '}
                                                        {feedback.score}
                                                    </Chip>
                                                ) : null}
                                                <Typography
                                                    level="body3"
                                                    className="whitespace-nowrap text-muted-foreground"
                                                >
                                                    <LocalDateTime time={false}>
                                                        {feedback.createdAt}
                                                    </LocalDateTime>
                                                </Typography>
                                                <Typography
                                                    level="body3"
                                                    mono
                                                    className="min-w-0 max-w-full break-words text-muted-foreground [overflow-wrap:anywhere]"
                                                >
                                                    <span className="font-sans">
                                                        Podaci:{' '}
                                                    </span>
                                                    {dataSummary}
                                                </Typography>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardOverflow>
            </Card>
        </Stack>
    );
}
