import { getFeedbacks } from "@gredice/storage";
import { Card, CardHeader, CardOverflow, CardTitle } from "@signalco/ui-primitives/Card";
import { Chip } from "@signalco/ui-primitives/Chip";
import { Table } from "@signalco/ui-primitives/Table";
import { auth } from "../../../lib/auth/auth";
import { NoDataPlaceholder } from "../../../components/shared/placeholders/NoDataPlaceholder";
import { LocaleDateTime } from "../../../components/shared/LocaleDateTime";

export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
    await auth(['admin']);
    const feedbacks = await getFeedbacks();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {"Povratne informacije"}
                    <Chip color="primary" size="sm">{feedbacks.length}</Chip>
                </CardTitle>
            </CardHeader>
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
                                <Table.Cell title={feedback.createdAt.toISOString()}>
                                    <LocaleDateTime time={false}>
                                        {feedback.createdAt}
                                    </LocaleDateTime>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            </CardOverflow>
        </Card>
    );
}