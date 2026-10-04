import { getEmailMessage } from '@gredice/storage';
import { Breadcrumbs } from '@gredice/ui/Breadcrumbs';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import {
    EntityDetailsPanelCard,
    EntityDetailsPropertiesLayout,
    EntityDetailsPropertiesPanel,
    EntityDetailsPropertiesProvider,
    EntityDetailsPropertiesToggle,
} from '../../../../../components/admin/details';
import { AdminPageHeader } from '../../../../../components/admin/navigation';
import { AdminBreadcrumbLevelSelector } from '../../../../../components/admin/navigation/AdminBreadcrumbLevelSelector';
import { AdminPageTitle } from '../../../../../components/admin/navigation/AdminPageTitle';
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
        <Stack spacing={1}>
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
        <Stack spacing={1}>
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
    const propertiesPanel = (
        <EntityDetailsPropertiesPanel>
            <EntityDetailsPanelCard title="Detalji slanja">
                <Stack spacing={4} className="px-4 pb-4">
                    <DetailItem label="Šalje">
                        <Typography>{email.fromAddress}</Typography>
                    </DetailItem>
                    <DetailItem label="Tip">
                        {email.messageType ? (
                            <Chip>{email.messageType}</Chip>
                        ) : (
                            <NoDataPlaceholder>Nije određeno</NoDataPlaceholder>
                        )}
                    </DetailItem>
                    <DetailItem label="Predložak">
                        {email.templateName ? (
                            <Typography>{email.templateName}</Typography>
                        ) : (
                            <NoDataPlaceholder>Nije određeno</NoDataPlaceholder>
                        )}
                    </DetailItem>
                    <DetailItem label="Provider ID">
                        {email.providerMessageId ? (
                            <code>{email.providerMessageId}</code>
                        ) : (
                            <NoDataPlaceholder>Nije dostupno</NoDataPlaceholder>
                        )}
                    </DetailItem>
                    <DetailItem label="Status pružatelja">
                        {email.providerStatus ? (
                            <Typography>{email.providerStatus}</Typography>
                        ) : (
                            <NoDataPlaceholder>Nije dostupno</NoDataPlaceholder>
                        )}
                    </DetailItem>
                    <DetailItem label="Kreirano">
                        <LocalDateTime>{email.createdAt}</LocalDateTime>
                    </DetailItem>
                    <DetailItem label="Zadnji pokušaj">
                        {email.lastAttemptAt ? (
                            <LocalDateTime>{email.lastAttemptAt}</LocalDateTime>
                        ) : (
                            <NoDataPlaceholder>Nije dostupno</NoDataPlaceholder>
                        )}
                    </DetailItem>
                    <DetailItem label="Poslano">
                        {email.sentAt ? (
                            <LocalDateTime>{email.sentAt}</LocalDateTime>
                        ) : (
                            <NoDataPlaceholder>Nije poslano</NoDataPlaceholder>
                        )}
                    </DetailItem>
                    <DetailItem label="Dovršeno">
                        {email.completedAt ? (
                            <LocalDateTime>{email.completedAt}</LocalDateTime>
                        ) : (
                            <NoDataPlaceholder>Nije dovršeno</NoDataPlaceholder>
                        )}
                    </DetailItem>
                    <DetailItem label="Odbijeno">
                        {email.bouncedAt ? (
                            <LocalDateTime>{email.bouncedAt}</LocalDateTime>
                        ) : (
                            <NoDataPlaceholder>Nije odbijeno</NoDataPlaceholder>
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
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Primatelji">
                <Stack spacing={4} className="px-4 pb-4">
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
                        {formatRecipients(email.recipients.replyTo)}
                    </DetailItem>
                </Stack>
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Prilozi">
                <div className="px-4 pb-4">
                    {email.attachments.length === 0 ? (
                        <NoDataPlaceholder>Nema priloga</NoDataPlaceholder>
                    ) : (
                        <Stack spacing={2}>
                            {email.attachments.map((attachment) => (
                                <Stack
                                    key={`${attachment.name}-${attachment.contentType ?? ''}`}
                                    spacing={1}
                                >
                                    <Typography>{attachment.name}</Typography>
                                    <Typography
                                        level="body2"
                                        className="text-muted-foreground"
                                    >
                                        {attachment.contentType ?? 'Nepoznato'}
                                        {attachment.size
                                            ? ` · ${formatAttachmentSize(attachment.size)}`
                                            : ''}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    )}
                </div>
            </EntityDetailsPanelCard>
            <EntityDetailsPanelCard title="Dodatni podaci">
                <div className="px-4 pb-4">
                    {email.metadata &&
                    Object.keys(email.metadata).length > 0 ? (
                        <pre className="text-sm whitespace-pre-wrap break-words rounded-md bg-muted p-4">
                            {JSON.stringify(email.metadata, null, 2)}
                        </pre>
                    ) : (
                        <NoDataPlaceholder>
                            Nema dodatnih podataka
                        </NoDataPlaceholder>
                    )}
                </div>
            </EntityDetailsPanelCard>
        </EntityDetailsPropertiesPanel>
    );

    return (
        <EntityDetailsPropertiesProvider>
            <Stack spacing={6}>
                <AdminPageTitle title={email.subject || `Email #${email.id}`} />
                <AdminPageHeader
                    breadcrumbs={
                        <Breadcrumbs
                            items={[
                                {
                                    label: <AdminBreadcrumbLevelSelector />,
                                    href: KnownPages.CommunicationEmails,
                                },
                                { label: `Email #${email.id}` },
                            ]}
                        />
                    }
                    actions={
                        <Row className="items-center" spacing={2}>
                            <EmailStatusBadge status={email.status} />
                            <EntityDetailsPropertiesToggle />
                        </Row>
                    }
                    heading={email.subject}
                />

                <EntityDetailsPropertiesLayout properties={propertiesPanel}>
                    <Stack spacing={4}>
                        <Row spacing={4} alignItems="center">
                            <Stack spacing={1} className="min-w-0">
                                <Typography
                                    level="h1"
                                    className="text-2xl"
                                    semiBold
                                >
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
                        </Row>

                        <Stack spacing={4}>
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
                    </Stack>
                </EntityDetailsPropertiesLayout>
            </Stack>
        </EntityDetailsPropertiesProvider>
    );
}
