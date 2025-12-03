import { getEmailMessage } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Breadcrumbs } from '@signalco/ui/Breadcrumbs';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Typography } from '@signalco/ui-primitives/Typography';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { NoDataPlaceholder } from '../../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../src/KnownPages';
import { EmailStatusBadge } from '../EmailStatusBadge';

export const dynamic = 'force-dynamic';

type DetailItemProps = {
    label: string;
    children: ReactNode;
};

function DetailItem({ label, children }: DetailItemProps) {
    return (
        <Stack spacing={0.5}>
            <Typography level="body2" className="text-muted-foreground">
                {label}
            </Typography>
            <div>{children}</div>
        </Stack>
    );
}

function formatRecipients(
    recipients?: { address: string; displayName?: string | null }[],
) {
    if (!recipients || recipients.length === 0) {
        return <NoDataPlaceholder>Nema primatelja</NoDataPlaceholder>;
    }

    return (
        <Stack spacing={0.5}>
            {recipients.map((recipient) => (
                <Typography
                    key={`${recipient.address}-${recipient.displayName ?? ''}`}
                >
                    {recipient.displayName
                        ? `${recipient.displayName} <${recipient.address}>`
                        : recipient.address}
                </Typography>
            ))}
        </Stack>
    );
}

function formatAttachmentSize(size?: number | null) {
    if (!size || size <= 0) {
        return null;
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }

    const formatted = value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return `${formatted} ${units[unitIndex]}`;
}

export default async function EmailDetailPage({
    params,
}: PageProps<'/admin/communication/emails/[emailId]'>) {
    await auth(['admin']);

    const { emailId } = await params;
    const id = Number.parseInt(emailId, 10);
    if (Number.isNaN(id)) {
        notFound();
    }

    const email = await getEmailMessage(id);
    if (!email) {
        notFound();
    }

    return (
        <Stack spacing={3}>
            <Breadcrumbs
                items={[
                    {
                        label: 'Poslani emailovi',
                        href: KnownPages.CommunicationEmails,
                    },
                    { label: `Email #${email.id}` },
                ]}
            />

            <Stack spacing={2}>
                <Row
                    spacing={2}
                    alignItems="center"
                    justifyContent="space-between"
                >
                    <Stack spacing={0.5} className="min-w-0">
                        <Typography level="h1" className="text-2xl" semiBold>
                            {email.subject}
                        </Typography>
                        {email.templateName && (
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Predložak: {email.templateName}
                            </Typography>
                        )}
                    </Stack>
                    <EmailStatusBadge status={email.status} />
                </Row>

                <Row spacing={2} className="flex-wrap" alignItems="stretch">
                    <Stack spacing={2} className="flex-1 min-w-[18rem]">
                        <Card>
                            <CardHeader>
                                <CardTitle>Detalji slanja</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={2}>
                                    <DetailItem label="Šalje">
                                        <Typography>
                                            {email.fromAddress}
                                        </Typography>
                                    </DetailItem>
                                    <DetailItem label="Tip">
                                        {email.messageType ? (
                                            <Chip className="w-fit">
                                                {email.messageType}
                                            </Chip>
                                        ) : (
                                            <NoDataPlaceholder>
                                                Nije određeno
                                            </NoDataPlaceholder>
                                        )}
                                    </DetailItem>
                                    <DetailItem label="Predložak">
                                        {email.templateName ? (
                                            <Typography>
                                                {email.templateName}
                                            </Typography>
                                        ) : (
                                            <NoDataPlaceholder>
                                                Nije određeno
                                            </NoDataPlaceholder>
                                        )}
                                    </DetailItem>
                                    <DetailItem label="Provider ID">
                                        {email.providerMessageId ? (
                                            <code>
                                                {email.providerMessageId}
                                            </code>
                                        ) : (
                                            <NoDataPlaceholder>
                                                Nije dostupno
                                            </NoDataPlaceholder>
                                        )}
                                    </DetailItem>
                                    <DetailItem label="Status pružatelja">
                                        {email.providerStatus ? (
                                            <Typography>
                                                {email.providerStatus}
                                            </Typography>
                                        ) : (
                                            <NoDataPlaceholder>
                                                Nije dostupno
                                            </NoDataPlaceholder>
                                        )}
                                    </DetailItem>
                                    <DetailItem label="Kreirano">
                                        <LocalDateTime>
                                            {email.createdAt}
                                        </LocalDateTime>
                                    </DetailItem>
                                    <DetailItem label="Zadnji pokušaj">
                                        {email.lastAttemptAt ? (
                                            <LocalDateTime>
                                                {email.lastAttemptAt}
                                            </LocalDateTime>
                                        ) : (
                                            <NoDataPlaceholder>
                                                Nije dostupno
                                            </NoDataPlaceholder>
                                        )}
                                    </DetailItem>
                                    <DetailItem label="Poslano">
                                        {email.sentAt ? (
                                            <LocalDateTime>
                                                {email.sentAt}
                                            </LocalDateTime>
                                        ) : (
                                            <NoDataPlaceholder>
                                                Nije poslano
                                            </NoDataPlaceholder>
                                        )}
                                    </DetailItem>
                                    <DetailItem label="Dovršeno">
                                        {email.completedAt ? (
                                            <LocalDateTime>
                                                {email.completedAt}
                                            </LocalDateTime>
                                        ) : (
                                            <NoDataPlaceholder>
                                                Nije dovršeno
                                            </NoDataPlaceholder>
                                        )}
                                    </DetailItem>
                                    <DetailItem label="Odbijeno">
                                        {email.bouncedAt ? (
                                            <LocalDateTime>
                                                {email.bouncedAt}
                                            </LocalDateTime>
                                        ) : (
                                            <NoDataPlaceholder>
                                                Nije odbijeno
                                            </NoDataPlaceholder>
                                        )}
                                    </DetailItem>
                                    {email.errorMessage && (
                                        <DetailItem label="Greška">
                                            <Typography className="text-destructive">
                                                {email.errorMessage}
                                            </Typography>
                                            {email.errorCode && (
                                                <Typography
                                                    level="body2"
                                                    className="text-muted-foreground"
                                                >
                                                    Kod: {email.errorCode}
                                                </Typography>
                                            )}
                                        </DetailItem>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Primatelji</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Stack spacing={2}>
                                    <DetailItem label="Za">
                                        {formatRecipients(email.recipients.to)}
                                    </DetailItem>
                                    <DetailItem label="CC">
                                        {formatRecipients(email.recipients.cc)}
                                    </DetailItem>
                                    <DetailItem label="BCC">
                                        {formatRecipients(email.recipients.bcc)}
                                    </DetailItem>
                                    <DetailItem label="Reply-To">
                                        {formatRecipients(
                                            email.recipients.replyTo,
                                        )}
                                    </DetailItem>
                                </Stack>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Prilozi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {email.attachments.length === 0 ? (
                                    <NoDataPlaceholder>
                                        Nema priloga
                                    </NoDataPlaceholder>
                                ) : (
                                    <Stack spacing={1}>
                                        {email.attachments.map((attachment) => (
                                            <Stack
                                                key={`${attachment.name}-${attachment.contentType ?? ''}`}
                                                spacing={0.5}
                                            >
                                                <Typography>
                                                    {attachment.name}
                                                </Typography>
                                                <Typography
                                                    level="body2"
                                                    className="text-muted-foreground"
                                                >
                                                    {attachment.contentType ??
                                                        'Nepoznato'}
                                                    {attachment.size
                                                        ? ` · ${formatAttachmentSize(attachment.size)}`
                                                        : ''}
                                                </Typography>
                                            </Stack>
                                        ))}
                                    </Stack>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Dodatni podaci</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {email.metadata &&
                                Object.keys(email.metadata).length > 0 ? (
                                    <pre className="text-sm whitespace-pre-wrap break-words rounded-md bg-muted p-4">
                                        {JSON.stringify(
                                            email.metadata,
                                            null,
                                            2,
                                        )}
                                    </pre>
                                ) : (
                                    <NoDataPlaceholder>
                                        Nema dodatnih podataka
                                    </NoDataPlaceholder>
                                )}
                            </CardContent>
                        </Card>
                    </Stack>

                    <Stack spacing={2} className="flex-1 min-w-[18rem]">
                        <Card>
                            <CardHeader>
                                <CardTitle>HTML sadržaj</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {email.htmlBody ? (
                                    <div
                                        className="rounded-md border bg-background p-4 shadow-inner"
                                        // biome-ignore lint/security/noDangerouslySetInnerHtml: Email HTML is generated by our system.
                                        dangerouslySetInnerHTML={{
                                            __html: email.htmlBody,
                                        }}
                                    />
                                ) : (
                                    <NoDataPlaceholder>
                                        Nema HTML sadržaja
                                    </NoDataPlaceholder>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Tekstualni sadržaj</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {email.textBody ? (
                                    <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-4 text-sm">
                                        {email.textBody}
                                    </pre>
                                ) : (
                                    <NoDataPlaceholder>
                                        Nema tekstualnog sadržaja
                                    </NoDataPlaceholder>
                                )}
                            </CardContent>
                        </Card>
                    </Stack>
                </Row>
            </Stack>
        </Stack>
    );
}
