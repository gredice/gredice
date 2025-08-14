import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { Accordion } from "@signalco/ui/Accordion";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoDataPlaceholder } from "../../components/shared/placeholders/NoDataPlaceholder";
import { Markdown } from "../../components/shared/Markdown";
import { FeedbackModal } from "../../components/shared/feedback/FeedbackModal";
import { Row } from "@signalco/ui-primitives/Row";
import { getFaqData } from "../../lib/plants/getFaqData";
import { orderBy } from "@signalco/js";
import { Metadata } from "next";
import { WhatsAppCard } from "../../components/social/WhatsAppCard";

export const revalidate = 3600; // 1 hour
export const metadata: Metadata = {
    title: "Česta pitanja",
    description: "Odgovaramo na sva tvoja pitanja.",
};

export default async function FaqPage() {
    const faq = await getFaqData();
    const categories = orderBy([...new Set(faq?.map((item) => item.attributes?.category?.information?.label))], (a, b) => a && b ? a.localeCompare(b) : 0);

    return (
        <Stack>
            <PageHeader
                header="Česta pitanja"
                subHeader="Odgovaramo na sva tvoja pitanja."
                padded />
            <Stack spacing={4}>
                {!faq?.length && (
                    <div className=" border rounded py-4 md:col-span-2">
                        <NoDataPlaceholder>
                            Nema dostupnih pitanja
                        </NoDataPlaceholder>
                    </div>
                )}
                {categories.map((category) => (
                    <Stack key={category} spacing={2}>
                        <Typography level="h4">{category}</Typography>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {faq?.filter((item) => item.attributes?.category?.information?.label === category).map((item) => (
                                <Accordion key={item.information.name} className="h-min">
                                    <Typography className="px-3" semiBold>{item.information.header}</Typography>
                                    <Markdown className="px-3">{item.information.content}</Markdown>
                                </Accordion>
                            ))}
                        </div>
                    </Stack>
                ))}
                <Stack spacing={2}>
                    <Typography level="h4">Nema tvojeg pitanja?</Typography>
                    <WhatsAppCard />
                </Stack>
            </Stack>
            <Row spacing={2} className="mt-8">
                <Typography level="body1">Jesu li ti informacije korisne?</Typography>
                <FeedbackModal topic="www/faq" />
            </Row>
        </Stack>
    );
}