import {
    type EmailStatus,
    emailStatusEnum,
    getEmailMessages,
} from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
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

function EmailDateValue({
    label,
    value,
    fallback,
}: {
    label: string;
    value: Date | string | null | undefined;
    fallback?: string;
}) {
    return (
        <Typography
            component="span"
            level="body3"
            className="text-muted-foreground"
        >
            <span className="font-medium text-foreground">{label}: </span>
            {value ? (
                <span className="whitespace-nowrap">
                    <LocalDateTime>{value}</LocalDateTime>
                </span>
            ) : (
                fallback
            )}
        </Typography>
    );
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

    // Fetch one extra item to check if there are more pages
    const emailsResult = await getEmailMessages({
        status: selectedStatus,
        limit: ITEMS_PER_PAGE + 1,
        offset,
    });

    const hasMorePages = emailsResult.length > ITEMS_PER_PAGE;
    const emails = emailsResult.slice(0, ITEMS_PER_PAGE);

    return (
        <Stack spacing={4}>
            <Row spacing={2}>
                <Chip color="primary">{emails.length}</Chip>
            </Row>

            <Row spacing={2} className="flex-wrap gap-2">
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
                    {emails.length === 0 ? (
                        <div className="p-4">
                            <NoDataPlaceholder>
                                Trenutno nema emailova za prikaz.
                            </NoDataPlaceholder>
                        </div>
                    ) : (
                        <ul className="divide-y">
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
                                    <li
                                        key={email.id}
                                        className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                                    >
                                        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <Stack
                                                spacing={2}
                                                className="min-w-0 flex-1"
                                            >
                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0"
                                                >
                                                    <Typography
                                                        component="h3"
                                                        level="body1"
                                                        semiBold
                                                        className="min-w-0"
                                                    >
                                                        <Link
                                                            href={KnownPages.CommunicationEmail(
                                                                email.id,
                                                            )}
                                                            className="break-words text-primary underline-offset-2 hover:underline [overflow-wrap:anywhere]"
                                                        >
                                                            {email.subject}
                                                        </Link>
                                                    </Typography>
                                                    {email.templateName && (
                                                        <Typography
                                                            level="body2"
                                                            className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]"
                                                        >
                                                            {email.templateName}
                                                        </Typography>
                                                    )}
                                                </Stack>

                                                <Stack
                                                    spacing={1}
                                                    className="min-w-0"
                                                >
                                                    <Typography
                                                        level="body3"
                                                        uppercase
                                                        className="text-muted-foreground"
                                                    >
                                                        Primatelji
                                                    </Typography>
                                                    <Typography
                                                        level="body2"
                                                        className="min-w-0 break-words [overflow-wrap:anywhere]"
                                                    >
                                                        <span className="font-medium text-foreground">
                                                            Za:{' '}
                                                        </span>
                                                        {toRecipients}
                                                    </Typography>
                                                    {ccRecipients && (
                                                        <Typography
                                                            level="body2"
                                                            className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]"
                                                        >
                                                            <span className="font-medium text-foreground">
                                                                CC:{' '}
                                                            </span>
                                                            {ccRecipients}
                                                        </Typography>
                                                    )}
                                                    {bccRecipients && (
                                                        <Typography
                                                            level="body2"
                                                            className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]"
                                                        >
                                                            <span className="font-medium text-foreground">
                                                                BCC:{' '}
                                                            </span>
                                                            {bccRecipients}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </Stack>

                                            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start lg:max-w-[32rem] lg:justify-end">
                                                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                                                    <EmailStatusBadge
                                                        status={email.status}
                                                    />
                                                    {email.providerStatus && (
                                                        <Typography
                                                            component="span"
                                                            level="body3"
                                                            className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]"
                                                        >
                                                            {
                                                                email.providerStatus
                                                            }
                                                        </Typography>
                                                    )}
                                                </div>

                                                <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
                                                    <Typography
                                                        component="span"
                                                        level="body3"
                                                        className="font-medium text-foreground"
                                                    >
                                                        Tip:
                                                    </Typography>
                                                    {email.messageType ? (
                                                        <Chip
                                                            size="sm"
                                                            className="whitespace-normal break-words [overflow-wrap:anywhere]"
                                                        >
                                                            {email.messageType}
                                                        </Chip>
                                                    ) : (
                                                        <NoDataPlaceholder className="!text-left">
                                                            Nije određeno
                                                        </NoDataPlaceholder>
                                                    )}
                                                </div>

                                                <div className="grid min-w-0 gap-1 sm:basis-full sm:grid-cols-2 lg:text-right">
                                                    <EmailDateValue
                                                        label="Poslano"
                                                        value={email.sentAt}
                                                        fallback="Nije poslano"
                                                    />
                                                    <EmailDateValue
                                                        label="Kreirano"
                                                        value={email.createdAt}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardOverflow>
            </Card>

            {/* Pagination Controls */}
            {(currentPage > 1 || hasMorePages) && (
                <Row spacing={4} className="justify-center items-center">
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
                    {hasMorePages && (
                        <Link
                            href={buildPageHref(
                                currentPage + 1,
                                selectedStatus,
                            )}
                        >
                            <Chip className="cursor-pointer">Sljedeća →</Chip>
                        </Link>
                    )}
                </Row>
            )}
        </Stack>
    );
}
