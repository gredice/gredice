import {
    type CommunityEditRequestStatus,
    getCommunityEditRequest,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip, type ColorPaletteProp } from '@gredice/ui/Chip';
import { ExternalLink } from '@gredice/ui/icons';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import {
    approveCommunityEditRequestAction,
    markCommunityEditRequestConflictedAction,
    rejectCommunityEditRequestAction,
} from '../actions';

export const dynamic = 'force-dynamic';

type CommunityEditRequest = NonNullable<
    Awaited<ReturnType<typeof getCommunityEditRequest>>
>;
type CommunityEditChange = CommunityEditRequest['changes'][number];

type CompactTextDiff = {
    format: 'compact-text-diff-v1';
    prefixLength: number;
    suffixLength: number;
    removed: string;
    added: string;
};

type CommunityOperationSuggestionValue = {
    format: 'community-operation-suggestion-v1';
    intent: 'add' | 'remove';
    operationId: number;
    operationLabel: string;
    stageName: string;
    stageLabel: string;
    currentState: 'absent' | 'present';
    note?: string;
    source?: string;
};

function statusLabel(status: CommunityEditRequestStatus) {
    switch (status) {
        case 'pending':
            return 'Na čekanju';
        case 'approved':
            return 'Odobreno';
        case 'applied':
            return 'Primijenjeno';
        case 'rejected':
            return 'Odbijeno';
        case 'conflicted':
            return 'Konflikt';
        case 'canceled':
            return 'Otkazano';
    }
}

function statusColor(status: CommunityEditRequestStatus): ColorPaletteProp {
    switch (status) {
        case 'pending':
            return 'warning';
        case 'approved':
            return 'info';
        case 'applied':
            return 'success';
        case 'rejected':
        case 'canceled':
            return 'neutral';
        case 'conflicted':
            return 'error';
    }
}

function entityTypeLabel(entityTypeName: string) {
    switch (entityTypeName) {
        case 'plant':
            return 'Biljka';
        case 'plantSort':
            return 'Sorta';
        case 'operation':
            return 'Radnja';
        case 'block':
            return 'Blok';
        default:
            return entityTypeName;
    }
}

function publicPageUrl(publicPath: string) {
    if (/^https?:\/\//u.test(publicPath)) {
        return publicPath;
    }

    return `https://www.gredice.com${publicPath.startsWith('/') ? '' : '/'}${publicPath}`;
}

function isCompactTextDiff(value: unknown): value is CompactTextDiff {
    return (
        typeof value === 'object' &&
        value !== null &&
        'format' in value &&
        value.format === 'compact-text-diff-v1' &&
        'prefixLength' in value &&
        typeof value.prefixLength === 'number' &&
        'suffixLength' in value &&
        typeof value.suffixLength === 'number' &&
        'removed' in value &&
        typeof value.removed === 'string' &&
        'added' in value &&
        typeof value.added === 'string'
    );
}

function parseCompactTextDiff(reviewDiff: string | null) {
    if (!reviewDiff) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(reviewDiff);
        return isCompactTextDiff(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function isCommunityOperationSuggestion(
    value: unknown,
): value is CommunityOperationSuggestionValue {
    return (
        typeof value === 'object' &&
        value !== null &&
        'format' in value &&
        value.format === 'community-operation-suggestion-v1' &&
        'intent' in value &&
        (value.intent === 'add' || value.intent === 'remove') &&
        'operationId' in value &&
        typeof value.operationId === 'number' &&
        'operationLabel' in value &&
        typeof value.operationLabel === 'string' &&
        'stageName' in value &&
        typeof value.stageName === 'string' &&
        'stageLabel' in value &&
        typeof value.stageLabel === 'string' &&
        'currentState' in value &&
        (value.currentState === 'absent' || value.currentState === 'present')
    );
}

function parseCommunityOperationSuggestion(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        return isCommunityOperationSuggestion(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function operationSuggestionIntentLabel(intent: 'add' | 'remove') {
    switch (intent) {
        case 'add':
            return 'Dodaj radnju';
        case 'remove':
            return 'Ukloni radnju';
    }
}

function operationSuggestionStateLabel(state: 'absent' | 'present') {
    switch (state) {
        case 'absent':
            return 'Radnja nije bila povezana';
        case 'present':
            return 'Radnja je bila povezana';
    }
}

function ValueBlock({ label, value }: { label: string; value: string | null }) {
    return (
        <Stack spacing={1} className="min-w-0">
            <Typography level="body2" className="text-muted-foreground">
                {label}
            </Typography>
            {value === null || value.length === 0 ? (
                <NoDataPlaceholder>Nema vrijednosti</NoDataPlaceholder>
            ) : (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted p-3 text-xs leading-relaxed">
                    {value}
                </pre>
            )}
        </Stack>
    );
}

function OperationSuggestionBlock({
    suggestion,
}: {
    suggestion: CommunityOperationSuggestionValue;
}) {
    return (
        <Stack spacing={3}>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Namjera">
                    <Chip
                        color={
                            suggestion.intent === 'add' ? 'success' : 'warning'
                        }
                        variant="soft"
                    >
                        {operationSuggestionIntentLabel(suggestion.intent)}
                    </Chip>
                </DetailItem>
                <DetailItem label="Stadij">
                    <Typography>
                        {suggestion.stageLabel} ({suggestion.stageName})
                    </Typography>
                </DetailItem>
                <DetailItem label="Radnja">
                    <Typography>
                        {suggestion.operationLabel} #{suggestion.operationId}
                    </Typography>
                </DetailItem>
                <DetailItem label="Stanje pri slanju">
                    <Typography>
                        {operationSuggestionStateLabel(suggestion.currentState)}
                    </Typography>
                </DetailItem>
            </div>
            {suggestion.source ? (
                <DetailItem label="Izvor">
                    <Typography className="whitespace-pre-line break-words">
                        {suggestion.source}
                    </Typography>
                </DetailItem>
            ) : null}
            {suggestion.note ? (
                <DetailItem label="Napomena">
                    <Typography className="whitespace-pre-line">
                        {suggestion.note}
                    </Typography>
                </DetailItem>
            ) : null}
        </Stack>
    );
}

function DiffBlock({ change }: { change: CommunityEditChange }) {
    const diff = parseCompactTextDiff(change.reviewDiff);
    if (!diff) {
        return null;
    }

    return (
        <Stack spacing={1}>
            <Typography level="body2" className="text-muted-foreground">
                Sažetak razlike
            </Typography>
            <div className="grid gap-2 md:grid-cols-2">
                <Stack spacing={1}>
                    <Typography level="body3" className="text-red-700">
                        Uklonjeno
                    </Typography>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-relaxed dark:border-red-900 dark:bg-red-950">
                        {diff.removed || 'Nema uklonjenog teksta'}
                    </pre>
                </Stack>
                <Stack spacing={1}>
                    <Typography level="body3" className="text-green-700">
                        Dodano
                    </Typography>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-green-200 bg-green-50 p-3 text-xs leading-relaxed dark:border-green-900 dark:bg-green-950">
                        {diff.added || 'Nema dodanog teksta'}
                    </pre>
                </Stack>
            </div>
            <Typography level="body3" className="text-muted-foreground">
                Zajednički početak: {diff.prefixLength} znakova, zajednički
                kraj: {diff.suffixLength} znakova.
            </Typography>
        </Stack>
    );
}

function ChangeBody({ change }: { change: CommunityEditChange }) {
    const operationSuggestion = parseCommunityOperationSuggestion(
        change.proposedValue,
    );
    if (operationSuggestion) {
        return <OperationSuggestionBlock suggestion={operationSuggestion} />;
    }

    return (
        <Stack spacing={4}>
            <div className="grid gap-4 lg:grid-cols-2">
                <ValueBlock label="Trenutno" value={change.previousValue} />
                <ValueBlock label="Predloženo" value={change.proposedValue} />
            </div>
            <DiffBlock change={change} />
        </Stack>
    );
}

function DetailItem({
    children,
    label,
}: {
    children: ReactNode;
    label: string;
}) {
    return (
        <Stack spacing={1}>
            <Typography level="body2" className="text-muted-foreground">
                {label}
            </Typography>
            <div>{children}</div>
        </Stack>
    );
}

function ReviewNote() {
    return (
        <label className="block space-y-1">
            <Typography level="body2">Napomena moderatora</Typography>
            <textarea
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                name="reviewerNote"
                placeholder="Interna napomena ili objašnjenje za odbijanje..."
            />
        </label>
    );
}

function ReviewActions({ request }: { request: CommunityEditRequest }) {
    const canReview =
        request.status === 'pending' || request.status === 'approved';
    if (!canReview) {
        return (
            <NoDataPlaceholder>
                Ovaj prijedlog više nije u statusu za moderiranje.
            </NoDataPlaceholder>
        );
    }

    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <form
                action={approveCommunityEditRequestAction.bind(
                    null,
                    request.id,
                )}
                className="space-y-3"
            >
                <ReviewNote />
                <Button color="success" type="submit">
                    Odobri i primijeni
                </Button>
            </form>
            <form
                action={rejectCommunityEditRequestAction.bind(null, request.id)}
                className="space-y-3"
            >
                <ReviewNote />
                <Button color="danger" type="submit" variant="outlined">
                    Odbij
                </Button>
            </form>
            <form
                action={markCommunityEditRequestConflictedAction.bind(
                    null,
                    request.id,
                )}
                className="space-y-3"
            >
                <ReviewNote />
                <Button color="warning" type="submit" variant="outlined">
                    Označi konflikt
                </Button>
            </form>
        </div>
    );
}

export default async function CommunityEditDetailPage({
    params,
}: PageProps<'/admin/community-edits/[requestId]'>) {
    await auth(['admin']);

    const { requestId } = await params;
    const id = Number.parseInt(requestId, 10);
    if (!Number.isInteger(id)) {
        notFound();
    }

    const request = await getCommunityEditRequest(id);
    if (!request) {
        notFound();
    }

    return (
        <Stack spacing={4}>
            <Row spacing={2} className="flex-wrap gap-2">
                <Link href={KnownPages.CommunityEdits}>Prijedlozi</Link>
                <Typography level="body2" className="text-muted-foreground">
                    / #{request.id}
                </Typography>
                <Chip
                    color={statusColor(
                        request.status as CommunityEditRequestStatus,
                    )}
                    variant="soft"
                >
                    {statusLabel(request.status as CommunityEditRequestStatus)}
                </Chip>
            </Row>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {entityTypeLabel(request.entityTypeName)} #
                        {request.entityId}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <DetailItem label="Admin zapis">
                            <Link
                                href={KnownPages.DirectoryEntity(
                                    request.entityTypeName,
                                    request.entityId,
                                )}
                            >
                                Otvori zapis
                            </Link>
                        </DetailItem>
                        <DetailItem label="Javna stranica">
                            <a
                                className="inline-flex items-center gap-1 underline"
                                href={publicPageUrl(request.publicPath)}
                                rel="noreferrer"
                                target="_blank"
                            >
                                Otvori stranicu
                                <ExternalLink className="size-3.5" />
                            </a>
                        </DetailItem>
                        <DetailItem label="Sekcija">
                            <Typography>
                                {request.sectionKey ?? 'Cijela stranica'}
                            </Typography>
                        </DetailItem>
                        <DetailItem label="Kreirano">
                            <LocalDateTime>{request.createdAt}</LocalDateTime>
                        </DetailItem>
                        <DetailItem label="Pošiljatelj">
                            <Stack spacing={1}>
                                <Typography>
                                    {request.submitterName ??
                                        request.submitterUserId}
                                </Typography>
                                {request.submitterEmail ? (
                                    <Typography
                                        level="body3"
                                        className="text-muted-foreground"
                                    >
                                        {request.submitterEmail}
                                    </Typography>
                                ) : null}
                            </Stack>
                        </DetailItem>
                        <DetailItem label="Moderator">
                            {request.reviewerName ? (
                                <Typography>{request.reviewerName}</Typography>
                            ) : (
                                <NoDataPlaceholder>
                                    Nije pregledano
                                </NoDataPlaceholder>
                            )}
                        </DetailItem>
                        <DetailItem label="Pregledano">
                            {request.reviewedAt ? (
                                <LocalDateTime>
                                    {request.reviewedAt}
                                </LocalDateTime>
                            ) : (
                                <NoDataPlaceholder>
                                    Nije pregledano
                                </NoDataPlaceholder>
                            )}
                        </DetailItem>
                        <DetailItem label="Primijenjeno">
                            {request.appliedAt ? (
                                <LocalDateTime>
                                    {request.appliedAt}
                                </LocalDateTime>
                            ) : (
                                <NoDataPlaceholder>
                                    Nije primijenjeno
                                </NoDataPlaceholder>
                            )}
                        </DetailItem>
                    </div>
                    {request.submitterNote ? (
                        <Stack spacing={1} className="mt-4">
                            <Typography
                                level="body2"
                                className="text-muted-foreground"
                            >
                                Napomena pošiljatelja
                            </Typography>
                            <Typography className="whitespace-pre-line">
                                {request.submitterNote}
                            </Typography>
                        </Stack>
                    ) : null}
                    {request.reviewerNote ||
                    request.applicationFailureReason ? (
                        <Stack spacing={2} className="mt-4">
                            {request.reviewerNote ? (
                                <DetailItem label="Napomena moderatora">
                                    <Typography className="whitespace-pre-line">
                                        {request.reviewerNote}
                                    </Typography>
                                </DetailItem>
                            ) : null}
                            {request.applicationFailureReason ? (
                                <DetailItem label="Razlog konflikta">
                                    <Typography className="whitespace-pre-line text-red-700">
                                        {request.applicationFailureReason}
                                    </Typography>
                                </DetailItem>
                            ) : null}
                        </Stack>
                    ) : null}
                </CardContent>
            </Card>

            <Stack spacing={3}>
                <Typography level="h2" className="text-xl">
                    Promjene
                </Typography>
                {request.changes.map((change) => (
                    <Card key={change.id}>
                        <CardHeader>
                            <CardTitle className="text-lg">
                                {change.attributeDefinition.label ??
                                    change.fieldKey}
                            </CardTitle>
                            <Typography
                                level="body3"
                                className="text-muted-foreground"
                            >
                                {change.attributePath} · {change.dataType}
                            </Typography>
                        </CardHeader>
                        <CardContent>
                            <ChangeBody change={change} />
                        </CardContent>
                    </Card>
                ))}
            </Stack>

            <Card>
                <CardHeader>
                    <CardTitle>Moderiranje</CardTitle>
                </CardHeader>
                <CardContent>
                    <ReviewActions request={request} />
                </CardContent>
            </Card>
        </Stack>
    );
}
