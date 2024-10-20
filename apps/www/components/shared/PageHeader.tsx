import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { PropsWithChildren } from "react";

export function PageHeader({ children, header, subHeader }: PropsWithChildren<{ header: string, subHeader: string }>) {
    return (
        <div className="py-12 md:py-24 flex flex-col md:flex-row gap-4 justify-between">
            <Stack spacing={1} className="max-w-96">
                <Typography level="h2" component="h1">{header}</Typography>
                <Typography level="body1" secondary className="text-balance">{subHeader}</Typography>
            </Stack>
            {children}
        </div>
    );
}