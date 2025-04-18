import { Card, CardHeader, CardOverflow } from "@signalco/ui-primitives/Card";
import Link from "next/link";
import { PropsWithChildren } from "react";

export function ItemCard({ children, label, href }: PropsWithChildren<{ label: string, href: string }>) {
    return (
        <Link href={href || ''} passHref prefetch>
            <Card className="overflow-hidden">
                <CardOverflow className="p-2 sm:p-4 md:p-6 aspect-square">
                    <div className="relative size-full">
                        {children}
                    </div>
                </CardOverflow>
                <CardHeader className="bg-muted/60 border-t -m-2 p-2 text-center">{label}</CardHeader>
            </Card>
        </Link>
    );
}