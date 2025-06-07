import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { PropsWithChildren, ReactNode } from "react";
import { cx } from "@signalco/ui-primitives/cx";

export type PageHeaderProps = {
    padded?: boolean;
    visual?: ReactNode;
    header: string;
    alternativeName?: ReactNode | string | null;
    subHeader?: string | null;
    headerChildren?: ReactNode;
};

export function PageHeader({
    children, padded, visual, header, alternativeName, subHeader, headerChildren
}: PropsWithChildren<PageHeaderProps>) {
    return (
        <div className={cx(
            "grid grid-cols-1 justify-between gap-4",
            'md:grid-cols-3',
            Boolean(children) && Boolean(visual) && "md:grid-cols-2",
            !children && Boolean(visual) && 'md:grid-cols-1',
            padded && "py-12 md:py-24"
        )}>
            <div className={cx("flex flex-col md:flex-row gap-4", !visual && "md:col-span-2")}>
                {visual && (
                    <Card className="min-w-48 min-h-48 size-48 shadow-lg">
                        <CardOverflow className="p-6">
                            {visual}
                        </CardOverflow>
                    </Card>
                )}
                <Stack spacing={2} className="md:max-w-96">
                    <Typography level="h2" component="h1">{header}</Typography>
                    {alternativeName && (
                        typeof alternativeName === 'string' ? (
                            <Typography level="body2" secondary>{alternativeName}</Typography>
                        ) : (
                            alternativeName
                        )
                    )}
                    {subHeader && <Typography level="body1" secondary className="text-balance">{subHeader}</Typography>}
                    {headerChildren}
                </Stack>
            </div>
            {children}
        </div>
    );
}