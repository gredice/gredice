import {
    type EmailStatus,
    emailStatusEnum,
    getEmailMessages,
} from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Card, CardOverflow } from '@signalco/ui-primitives/Card';
import { Chip } from '@signalco/ui-primitives/Chip';
import { Row } from '@signalco/ui-primitives/Row';
import { Stack } from '@signalco/ui-primitives/Stack';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { EmailStatusBadge } from './EmailStatusBadge';

export const dynamic = 'force-dynamic';

const STATUS_OPTIONS = ['all', ...emailStatusEnum.enumValues] as const;

type StatusOption = (typeof STATUS_OPTIONS)[number];

function isEmailStatus(value: string): value is EmailStatus {
    return emailStatusEnum.enumValues.includes(value as EmailStatus);
}

function buildStatusHref(status: StatusOption) {
    if (status === 'all') {
        return KnownPages.CommunicationEmails;
    }

    const search = new URLSearchParams({ status }).toString();
    return `${KnownPages.CommunicationEmails}?${search}` as const;
}

function buildPageHref(page: number, status?: EmailStatus) {
    const params = new URLSearchParams();
    if (status) {
        params.set('status', status);
    }
    if (page > 1) {
        params.set('page', page.toString());
    }
    const search = params.toString();
    return search
        ? `${KnownPages.CommunicationEmails}?${search}`
        : KnownPages.CommunicationEmails;
}

function formatRecipients(
    addresses: { address: string; displayName?: string | null }[],
) {
    return addresses
        .map((recipient) => recipient.displayName ?? recipient.address)
        .join(', ');
}

const ITEMS_PER_PAGE = 50;

export default async function EmailsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await auth(['admin']);

    const params = await searchParams;
    const statusParam =
        typeof params.status === 'string' ? params.status : undefined;
    const selectedStatus =
        statusParam && isEmailStatus(statusParam) ? statusParam : undefined;

    const pageParam = typeof params.page === 'string' ? params.page : undefined;
    const currentPage = pageParam
        ? Math.max(1, Number.parseInt(pageParam, 10))
        : 1;
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    const emails = await getEmailMessages({
        status: selectedStatus,
        limit: ITEMS_PER_PAGE,
        offset,
    });

    return (
        <Stack spacing={2}>
            <Row spacing={1}>
                <Typography level="h1" className="text-2xl" semiBold>
                    Poslani emailovi
                </Typography>
                <Chip color="primary">{emails.length}</Chip>
            </Row>

            <Row spacing={1} className="flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => {
                    const isActive =
                        (option === 'all' && !selectedStatus) ||
                        option === selectedStatus;
                    const label =
                        option === 'all'
                            ? 'Svi'
                            : {
                                  queued: 'Na čekanju',
                                  sending: 'U slanju',
                                  sent: 'Poslano',
                                  failed: 'Neuspješno',
                                  bounced: 'Odbijeno',
                              }[option];

                    return (
                        <Link
                            key={option}
                            href={buildStatusHref(option)}
                            prefetch={false}
                        >
                            <Chip
                                color={isActive ? 'primary' : 'neutral'}
                                className="cursor-pointer"
                            >
                                {label}
                            </Chip>
                        </Link>
                    );
                })}
            </Row>

            <Card>
                <CardOverflow>
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.Head>Naslov</Table.Head>
                                <Table.Head>Primatelji</Table.Head>
                                <Table.Head>Status</Table.Head>
                                <Table.Head>Tip</Table.Head>
                                <Table.Head>Poslano</Table.Head>
                                <Table.Head>Kreirano</Table.Head>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {emails.length === 0 && (
                                <Table.Row>
                                    <Table.Cell colSpan={6}>
                                        <NoDataPlaceholder>
                                            Trenutno nema emailova za prikaz.
                                        </NoDataPlaceholder>
                                    </Table.Cell>
                                </Table.Row>
                            )}
                            {emails.map((email) => {
                                const toRecipients = formatRecipients(
                                    email.recipients.to,
                                );
                                const ccRecipients = email.recipients.cc
                                    ? formatRecipients(email.recipients.cc)
                                    : null;
                                const bccRecipients = email.recipients.bcc
                                    ? formatRecipients(email.recipients.bcc)
                                    : null;

                                return (
                                    <Table.Row key={email.id}>
                                        <Table.Cell>
                                            <Stack spacing={0.5}>
                                                <Link
                                                    href={KnownPages.CommunicationEmail(
                                                        email.id,
                                                    )}
                                                >
                                                    {email.subject}
                                                </Link>
                                                {email.templateName && (
                                                    <Typography
                                                        level="body2"
                                                        className="text-muted-foreground"
                                                    >
                                                        {email.templateName}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={0.5}>
                                                <Typography>
                                                    {toRecipients}
                                                </Typography>
                                                {ccRecipients && (
                                                    <Typography
                                                        level="body2"
                                                        className="text-muted-foreground"
                                                    >
                                                        CC: {ccRecipients}
                                                    </Typography>
                                                )}
                                                {bccRecipients && (
                                                    <Typography
                                                        level="body2"
                                                        className="text-muted-foreground"
                                                    >
                                                        BCC: {bccRecipients}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            <Stack spacing={0.5}>
                                                <EmailStatusBadge
                                                    status={email.status}
                                                />
                                                {email.providerStatus && (
                                                    <Typography
                                                        level="body2"
                                                        className="text-muted-foreground"
                                                    >
                                                        {email.providerStatus}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Table.Cell>
                                        <Table.Cell>
                                            {email.messageType ? (
                                                <Chip className="w-fit">
                                                    {email.messageType}
                                                </Chip>
                                            ) : (
                                                <NoDataPlaceholder>
                                                    Nije određeno
                                                </NoDataPlaceholder>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            {email.sentAt ? (
                                                <LocalDateTime>
                                                    {email.sentAt}
                                                </LocalDateTime>
                                            ) : (
                                                <NoDataPlaceholder>
                                                    Nije poslano
                                                </NoDataPlaceholder>
                                            )}
                                        </Table.Cell>
                                        <Table.Cell>
                                            <LocalDateTime>
                                                {email.createdAt}
                                            </LocalDateTime>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table>
                </CardOverflow>
            </Card>

            {/* Pagination Controls */}
            {emails.length === ITEMS_PER_PAGE && (
                <Row spacing={2} className="justify-center items-center">
                    {currentPage > 1 && (
                        <Link
                            href={buildPageHref(
                                currentPage - 1,
                                selectedStatus,
                            )}
                        >
                            <Chip className="cursor-pointer">← Prethodna</Chip>
                        </Link>
                    )}
                    <Typography level="body2" className="text-muted-foreground">
                        Stranica {currentPage}
                    </Typography>
                    <Link href={buildPageHref(currentPage + 1, selectedStatus)}>
                        <Chip className="cursor-pointer">Sljedeća →</Chip>
                    </Link>
                </Row>
            )}
        </Stack>
    );
}
