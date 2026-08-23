import {
    getSurveyResponseAdmin,
    getSurveyWorkspaceAdminDetails,
} from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@gredice/ui/Card';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '../../../../../../lib/auth/auth';
import { KnownPages } from '../../../../../../src/KnownPages';
import { SurveyResponseJsonDetails } from '../../../SurveyResponseJsonDetails';
import { SurveyWorkspaceShell } from '../../../SurveyWorkspaceShell';
import {
    surveyResponseAnswerValue,
    surveyResponseContextLabel,
    surveyResponseSourceLabel,
} from '../../../surveyResponsePresentation';
import {
    canonicalSurveyResponseQuery,
    parseSurveyResponseQuery,
    type SurveyResponseSearchParams,
    surveyResponseHref,
} from '../../../surveyResponseQuery';

export const dynamic = 'force-dynamic';

export default async function SurveyResponseDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ responseId: string; surveyId: string }>;
    searchParams: Promise<SurveyResponseSearchParams>;
}) {
    await auth(['admin']);
    const { responseId, surveyId } = await params;
    const query = parseSurveyResponseQuery(await searchParams);
    const [details, item] = await Promise.all([
        getSurveyWorkspaceAdminDetails(surveyId),
        getSurveyResponseAdmin({ surveyId, responseId }),
    ]);
    if (!details || !item) {
        notFound();
    }

    const appliedVersionId =
        query.versionId &&
        details.versions.some((version) => version.id === query.versionId)
            ? query.versionId
            : null;
    const canonicalQuery = canonicalSurveyResponseQuery(
        query,
        appliedVersionId,
    );
    const backHref = surveyResponseHref(
        KnownPages.SurveyResponses(surveyId),
        canonicalQuery,
    );
    const contextLabel = surveyResponseContextLabel(
        item.assignment?.contextKey,
        item.assignment?.context.monthKey,
    );

    return (
        <SurveyWorkspaceShell
            actions={
                <Button href={backHref} variant="outlined">
                    Natrag na odgovore
                </Button>
            }
            survey={details.survey}
            view="responses"
        >
            <Card>
                <CardHeader>
                    <CardTitle>Detalji odgovora</CardTitle>
                </CardHeader>
                <CardContent>
                    <Stack spacing={4}>
                        <div className="flex flex-wrap gap-2">
                            <Chip>v{item.version.versionNumber}</Chip>
                            <Chip>
                                {surveyResponseSourceLabel(
                                    item.response.source,
                                )}
                            </Chip>
                            <Chip>{item.response.status}</Chip>
                        </div>

                        <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    ID odgovora
                                </dt>
                                <dd className="mt-1 break-all font-medium">
                                    {item.response.id}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Predano
                                </dt>
                                <dd className="mt-1 font-medium">
                                    <LocalDateTime>
                                        {item.response.submittedAt}
                                    </LocalDateTime>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Stvoreno
                                </dt>
                                <dd className="mt-1 font-medium">
                                    <LocalDateTime>
                                        {item.response.createdAt}
                                    </LocalDateTime>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Započeto
                                </dt>
                                <dd className="mt-1 font-medium">
                                    {item.response.startedAt ? (
                                        <LocalDateTime>
                                            {item.response.startedAt}
                                        </LocalDateTime>
                                    ) : (
                                        '-'
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Račun
                                </dt>
                                <dd className="mt-1 break-all font-medium">
                                    {item.accountId ? (
                                        <Link
                                            className="text-primary hover:underline"
                                            href={KnownPages.Account(
                                                item.accountId,
                                            )}
                                        >
                                            {item.accountId}
                                        </Link>
                                    ) : (
                                        '-'
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Korisnik
                                </dt>
                                <dd className="mt-1 break-words font-medium">
                                    {item.user ? (
                                        <Link
                                            className="text-primary hover:underline"
                                            href={KnownPages.User(item.user.id)}
                                        >
                                            {item.user.displayName ??
                                                item.user.userName}
                                        </Link>
                                    ) : (
                                        '-'
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Kontekst
                                </dt>
                                <dd className="mt-1 break-all font-medium">
                                    {contextLabel}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Verzija
                                </dt>
                                <dd className="mt-1 break-words font-medium">
                                    v{item.version.versionNumber} ·{' '}
                                    {item.version.title}
                                    <span className="block break-all text-xs font-normal text-muted-foreground">
                                        {item.version.id}
                                    </span>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    ID dodjele
                                </dt>
                                <dd className="mt-1 break-all font-medium">
                                    {item.assignment?.id ?? '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Status dodjele
                                </dt>
                                <dd className="mt-1 font-medium">
                                    {item.assignment?.status ?? '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    ID slanja
                                </dt>
                                <dd className="mt-1 break-all font-medium">
                                    {item.assignment?.sendId ?? '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Cilj dodjele
                                </dt>
                                <dd className="mt-1 break-all font-medium">
                                    {item.assignment?.targetKey ?? '-'}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs font-medium uppercase text-muted-foreground">
                                    Vanjski ID
                                </dt>
                                <dd className="mt-1 break-all font-medium">
                                    {item.response.importedExternalId ?? '-'}
                                </dd>
                            </div>
                        </dl>

                        <div>
                            <Typography semiBold>
                                Odgovori ({item.answers.length})
                            </Typography>
                            <ul className="mt-2 divide-y rounded-md border">
                                {item.answers.map((detail) => (
                                    <li
                                        className="grid gap-1 p-3 sm:grid-cols-[minmax(12rem,0.7fr)_minmax(0,1.3fr)]"
                                        key={detail.answer.id}
                                    >
                                        <div>
                                            <Typography semiBold>
                                                {detail.question.title}
                                            </Typography>
                                            <Typography
                                                level="body3"
                                                className="text-muted-foreground"
                                            >
                                                {detail.question.key} ·{' '}
                                                {detail.question.type}
                                            </Typography>
                                        </div>
                                        <Typography className="min-w-0 whitespace-pre-wrap break-words">
                                            {surveyResponseAnswerValue(detail)}
                                        </Typography>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <SurveyResponseJsonDetails
                                label="Metapodaci odgovora"
                                value={item.response.metadata}
                            />
                            <SurveyResponseJsonDetails
                                label="Kontekst dodjele"
                                value={item.assignment?.context ?? {}}
                            />
                        </div>
                    </Stack>
                </CardContent>
            </Card>
        </SurveyWorkspaceShell>
    );
}
