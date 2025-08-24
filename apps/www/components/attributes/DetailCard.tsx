import { NavigatingButton } from '@signalco/ui/NavigatingButton';
import { Info } from '@signalco/ui-icons';
import { Card, CardContent } from '@signalco/ui-primitives/Card';
import { IconButton } from '@signalco/ui-primitives/IconButton';
import { Modal } from '@signalco/ui-primitives/Modal';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';

export type AttributeCardProps = {
    icon: ReactNode;
    header: string;
    value: string | null | undefined;
    description?: string;
    navigateLabel?: string;
    navigateHref?: string;
};

export function AttributeCard({
    icon,
    header,
    value,
    description,
    navigateLabel,
    navigateHref,
}: AttributeCardProps) {
    return (
        <Card className="flex items-center gap-1 justify-between">
            <Row spacing={2}>
                <div className="flex-shrink-0 ml-2 text-primary">{icon}</div>
                <div>
                    <Typography level="body2" component="h3">
                        {header}
                    </Typography>
                    <Typography semiBold>{value ?? '-'}</Typography>
                </div>
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
                        <Row spacing={2}>
                            {icon}
                            <Stack spacing={1}>
                                <Typography level="h4">{header}</Typography>
                            </Stack>
                        </Row>
                        <Card>
                            <CardContent>
                                <Markdown>{description}</Markdown>
                            </CardContent>
                        </Card>
                        {navigateHref && navigateLabel && (
                            <NavigatingButton
                                href={navigateHref}
                                className="bg-green-800 hover:bg-green-700 self-end"
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
