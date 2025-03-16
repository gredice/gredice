import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { FaqData } from "./@types/FaqData";
import { Accordion } from "@signalco/ui/Accordion";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoDataPlaceholder } from "../../components/shared/placeholders/NoDataPlaceholder";
import { client } from "@gredice/client";
import { Markdown } from "../../components/shared/Markdown";
import { FeedbackModal } from "../../components/shared/feedback/FeedbackModal";
import { Row } from "@signalco/ui-primitives/Row";

export const dynamic = 'force-dynamic';

export default async function FaqPage() {
    const faq = await (await client().api.directories.entities[":entityType"].$get({
        param: {
            entityType: "faq"
        }
    })).json() as FaqData[];

    return (
        <Stack>
            <PageHeader
                header="Česta pitanja"
                subHeader="Odgovaramo na sva tvoja pitanja."
                padded />
            <Stack spacing={4} className="grid grid-cols-1 md:grid-cols-2">
                {!faq.length && (
                    <NoDataPlaceholder className="md:col-span-2" />
                )}
                {faq.map((item) => (
                    <Accordion key={item.information.name}>
                        <Typography className="px-3" semiBold>{item.information.header}</Typography>
                        <Markdown className="px-3">{item.information.content}</Markdown>
                    </Accordion>
                ))}
                <Row spacing={2}>
                    <Typography level="body1">Jesu li ti informacije bile korisne?</Typography>
                    <FeedbackModal topic="www/faq" />
                </Row>
            </Stack>
        </Stack>
    );
}