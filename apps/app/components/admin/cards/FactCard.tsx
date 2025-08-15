import { Card, CardOverflow } from "@signalco/ui-primitives/Card";
import { Stack } from "@signalco/ui-primitives/Stack";
import { Typography } from "@signalco/ui-primitives/Typography";
import { Row } from "@signalco/ui-primitives/Row";
import { cx } from "@signalco/ui-primitives/cx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@signalco/ui-primitives/Tooltip";

export function FactCard({ header, value, href, beforeValue }: { header: string, value: string | number, href?: string, beforeValue?: string | number }) {
    const hasChange = typeof beforeValue !== "undefined";
    const change = hasChange ? (Number(beforeValue) > 0 ? ((Number(value) - Number(beforeValue)) / Number(beforeValue)) * 100 : Number(value) * 100) : 0;
    const changeText = hasChange ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "";
    const changeCount = hasChange ? Number(value) - Number(beforeValue) : 0;
    const changeCountText = changeCount > 0 ? `+${changeCount}` : changeCount;

    const CardComponent = href ? 'a' : 'div';

    return (
        <CardComponent href={href}>
            <Card className={cx(href && "hover:border-primary transition-colors")}>
                <CardOverflow>
                    <Row className="p-2" spacing={1} justifyContent="space-between">
                        <Stack>
                            <Typography level="body3">{header}</Typography>
                            <Typography level="h4" semiBold>{value}</Typography>
                        </Stack>
                        {hasChange && (
                            <Stack className="self-end">
                                <Tooltip>
                                    <TooltipTrigger>
                                        <Typography level="body1"
                                            className={cx(
                                                change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "",
                                                "cursor-help text-right"
                                            )}>
                                            {changeCountText}
                                            <small>{` (${changeText})`}</small>
                                        </Typography>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <Typography>
                                            {changeCount > 0 ? "+" : ""}{changeCount} u odabranom vremenskom periodu
                                        </Typography>
                                    </TooltipContent>
                                </Tooltip>
                            </Stack>
                        )}
                    </Row>
                </CardOverflow>
            </Card>
        </CardComponent>
    );
}