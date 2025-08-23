import { Card, CardContent, CardHeader, CardTitle } from "@signalco/ui-primitives/Card";
import { cx } from "@signalco/ui-primitives/cx";
import { Navigate } from "@signalco/ui-icons";
import type { ReactNode } from "react";

export type SocialCardProps = {
    href: string;
    ctaText: string;
    icon: ReactNode;
    bgColor: string;
    bgIconColor: string;
    navigateIconColor: string;
};

export function SocialCard({ href, ctaText, icon, bgColor, bgIconColor, navigateIconColor }: SocialCardProps) {
    return (
        <a href={href} target="_blank" rel="noopener noreferrer">
            <Card className={cx(
                "h-full flex flex-row rounded-xl items-center justify-between max-w-md shadow hover:shadow-xl transition-all duration-300",
                bgColor)}>
                <CardHeader className={cx("flex flex-row gap-4 items-center")}>
                    <div className={cx("size-16 shrink-0 rounded-full flex items-center justify-center shadow-lg", bgIconColor)}>
                        {icon}
                    </div>
                    <CardTitle className="text-lg leading-tight font-bold text-gray-800 max-w-xs mx-auto">
                        {ctaText}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-2">
                    <Navigate className={cx("size-8 shrink-0", navigateIconColor)} />
                </CardContent>
            </Card>
        </a>
    );
}
