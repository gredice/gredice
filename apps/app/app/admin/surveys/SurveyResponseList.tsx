import type { getSurveyResponsePageAdmin } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';
import {
    surveyResponseAnswerValue,
    surveyResponseContextLabel,
    surveyResponseSourceLabel,
} from './surveyResponsePresentation';
import {
    type SurveyResponseQuery,
    surveyResponseHref,
} from './surveyResponseQuery';

type SurveyResults = NonNullable<
    Awaited<ReturnType<typeof getSurveyResponsePageAdmin>>
>;

export function SurveyResponseList({
    query,
    results,
}: {
    query: SurveyResponseQuery;
    results: SurveyResults;
}) {
    if (results.responses.length === 0) {
        return (
            <div className="p-4">
                <NoDataPlaceholder>
                    Nema odgovora za odabrane filtre
                </NoDataPlaceholder>
            </div>
        );
    }

    return (
        <ul className="divide-y">
            {results.responses.map((item) => {
                const context = surveyResponseContextLabel(
                    item.assignment?.contextKey,
                    item.assignment?.context.monthKey,
                );
                const detailHref = surveyResponseHref(
                    KnownPages.SurveyResponse(
                        results.survey.id,
                        item.response.id,
                    ),
                    query,
                );
                const previewAnswers = item.answers.slice(0, 3);

                return (
                    <li
                        key={item.response.id}
                        className="px-3 py-4 transition-colors hover:bg-muted/40 sm:px-4"
                    >
                        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(14rem,0.85fr)_minmax(0,1.15fr)_auto] lg:items-start">
                            <Stack spacing={2} className="min-w-0">
                                <div className="flex flex-wrap gap-2">
                                    <Chip>v{item.version.versionNumber}</Chip>
                                    <Chip>
                                        {surveyResponseSourceLabel(
                                            item.response.source,
                                        )}
                                    </Chip>
                                </div>
                                <Typography semiBold>
                                    <LocalDateTime>
                                        {item.response.submittedAt}
                                    </LocalDateTime>
                                </Typography>
                                <Typography
                                    level="body3"
                                    className="min-w-0 break-all text-muted-foreground"
                                >
                                    {context}
                                </Typography>
                            </Stack>

                            <Stack spacing={2} className="min-w-0">
                                <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                                    <div className="min-w-0">
                                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                                            Račun
                                        </dt>
                                        <dd className="min-w-0 break-all">
                                            {item.accountId ? (
                                                <Link
                                                    className="font-medium text-primary hover:underline"
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
                                    <div className="min-w-0">
                                        <dt className="text-xs font-medium uppercase text-muted-foreground">
                                            Korisnik
                                        </dt>
                                        <dd className="min-w-0 break-words">
                                            {item.user ? (
                                                <Link
                                                    className="font-medium text-primary hover:underline"
                                                    href={KnownPages.User(
                                                        item.user.id,
                                                    )}
                                                >
                                                    {item.user.displayName ??
                                                        item.user.userName}
                                                </Link>
                                            ) : (
                                                '-'
                                            )}
                                        </dd>
                                    </div>
                                </dl>

                                <Stack spacing={1} className="min-w-0">
                                    {previewAnswers.map((detail) => (
                                        <Typography
                                            key={detail.answer.id}
                                            level="body3"
                                            className="line-clamp-2 min-w-0 break-words"
                                        >
                                            <strong>
                                                {detail.question.title}:
                                            </strong>{' '}
                                            {surveyResponseAnswerValue(detail)}
                                        </Typography>
                                    ))}
                                    {item.answers.length >
                                    previewAnswers.length ? (
                                        <Typography
                                            level="body3"
                                            className="text-muted-foreground"
                                        >
                                            +{item.answers.length - 3} odgovora
                                        </Typography>
                                    ) : null}
                                </Stack>
                            </Stack>

                            <Button
                                href={detailHref}
                                size="sm"
                                variant="outlined"
                            >
                                Detalji
                            </Button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
