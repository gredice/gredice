import { Stack } from "@signalco/ui-primitives/Stack";
import { PageHeader } from "../../components/shared/PageHeader";
import { FaqData } from "./@types/FaqData";
import { Accordion } from "@signalco/ui/Accordion";
import Markdown from "react-markdown";
import { Typography } from "@signalco/ui-primitives/Typography";
import { NoDataPlaceholder } from "../../components/shared/placeholders/NoDataPlaceholder";
import { client } from "@gredice/client";

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
                        <div className="px-3 prose max-w-none">
                            <Markdown>{item.information.content}</Markdown>
                        </div>
                    </Accordion>
                ))}
            </Stack>
        </Stack>
    );
}