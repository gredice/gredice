import { getFeedbacks } from "@gredice/storage";
import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocalDateTime } from "@gredice/ui/LocalDateTime";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { Stack } from "@signalco/ui-primitives/Stack";

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
    await auth(['admin']);
    const feedbacks = await getFeedbacks();

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>Povratne informacije</Typography>
                <Chip color="primary">{feedbacks.length}</Chip>
            </Row>
            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Tema</Table.Head>
                                <Table.Head>Ocijena</Table.Head>
                                <Table.Head>Komentar</Table.Head>
                                <Table.Head>Podaci</Table.Head>
                                <Table.Head>Datum kreiranja</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {feedbacks.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={5}>
                                        <NoDataPlaceholder>
                                            Nema povratnih informacija
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {feedbacks.map(feedback => (
                                <Table.Row key={feedback.id}>
                                    <Table.Cell>
                                        {feedback.topic}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {feedback.score}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {feedback.comment}
                                    </Table.Cell>
                                    <Table.Cell>
                                        {JSON.stringify(feedback.data)}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <LocalDateTime time={false}>
                                            {feedback.createdAt}
                                        </LocalDateTime>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>
        </Stack>
    );
}