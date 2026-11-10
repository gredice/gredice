import { Markdown } from '@gredice/ui/Markdown';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';
import { Card, CardContent } from '../shared/Card';
import { AttributeInfoButton } from './AttributeInfoButton';

export type AttributeCardProps = {
    icon: ReactNode;
    header: string;
    subheader?: string;
    value?: ReactNode;
    description?: string;
    navigateLabel?: string;
    navigateHref?: string;
};

export function AttributeCard({
    icon,
    header,
    subheader,
    value,
    description,
    navigateLabel,
    navigateHref,
}: AttributeCardProps) {
    let valueContent: ReactNode;
    if (value == null) {
        valueContent = <Typography semiBold>-</Typography>;
    } else if (typeof value === 'string') {
        valueContent = value.trim().length ? (
            <Typography semiBold>{value}</Typography>
        ) : (
            <Typography semiBold>-</Typography>
        );
    } else if (typeof value === 'number') {
        valueContent = <Typography semiBold>{value}</Typography>;
    } else {
        valueContent = value;
    }

    return (
        <Card className="flex items-center gap-1 justify-between border-tertiary border-b-4">
            <Row spacing={4}>
                <div className="shrink-0 ml-2">{icon}</div>
                <Stack spacing={subheader ? 1 : 0}>
                    <Stack>
                        <Typography level="body2" component="h3">
                            {header}
                        </Typography>
                        {subheader && (
                            <Typography level="body3">{subheader}</Typography>
                        )}
                    </Stack>
                    {valueContent}
                </Stack>
            </Row>
            {description && (
                <AttributeInfoButton title={header}>
                    <Stack spacing={4}>
                        <Row spacing={4}>
                            {icon}
                            <Stack spacing={2}>
                                <Typography level="h4">{header}</Typography>
                            </Stack>
                        </Row>
                        <Card>
                            <CardContent noHeader>
                                <Markdown>{description}</Markdown>
                            </CardContent>
                        </Card>
                        {navigateHref && navigateLabel && (
                            <NavigatingButton
                                href={navigateHref}
                                color="brand"
                                className="self-end"
                            >
                                {navigateLabel}
                            </NavigatingButton>
                        )}
                    </Stack>
                </AttributeInfoButton>
            )}
        </Card>
    );
}
