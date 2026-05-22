import { Card, CardContent } from '@gredice/ui/Card';
import { IconButton } from '@gredice/ui/IconButton';
import { Info } from '@gredice/ui/icons';
import { Markdown } from '@gredice/ui/Markdown';
import { Modal } from '@gredice/ui/Modal';
import { NavigatingButton } from '@gredice/ui/NavigatingButton';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import type { ReactNode } from 'react';

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
                <Modal
                    title={header}
                    className="border border-tertiary border-b-4 max-w-xl"
                    trigger={
                        <IconButton
                            size="lg"
                            variant="plain"
                            aria-label={`Više informacija o ${header}`}
                        >
                            <Info />
                        </IconButton>
                    }
                >
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
                                className="bg-green-800 hover:bg-green-700 self-end dark:bg-green-700 dark:hover:bg-green-600 text-white"
                            >
                                {navigateLabel}
                            </NavigatingButton>
                        )}
                    </Stack>
                </Modal>
            )}
        </Card>
    );
}
