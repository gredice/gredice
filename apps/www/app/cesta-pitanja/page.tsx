import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { getEntitiesFormatted } from "@gredice/storage";
import { FaqData } from "./@types/FaqData";
import { Accordion } from "@signalco/ui/Accordion";
import Markdown from "react-markdown";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoDataPlaceholder } from "../../components/shared/placeholders/NoDataPlaceholder";

export const dynamic = 'force-dynamic';

export default async function FaqPage() {
    const faq = await getEntitiesFormatted<FaqData>("faq");
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
                        <div className="px-3">
                            <Markdown className="prose max-w-none">{item.information.content}</Markdown>
                        </div>
                    </Accordion>
                ))}
            </Stack>
        </Stack>
    );
}