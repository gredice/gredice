import { Button } from '@gredice/ui/Button';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../../src/KnownPages';
import {
    type SurveyResponseQuery,
    surveyResponseHref,
    surveyResponseQueryForPage,
} from './surveyResponseQuery';

export function SurveyResponsePagination({
    page,
    pageCount,
    query,
    surveyId,
    totalCount,
}: {
    page: number;
    pageCount: number;
    query: SurveyResponseQuery;
    surveyId: string;
    totalCount: number;
}) {
    if (pageCount === 0) return null;

    const listPath = KnownPages.SurveyResponses(surveyId);
    const previousHref = surveyResponseHref(
        listPath,
        surveyResponseQueryForPage(query, page - 1),
    );
    const nextHref = surveyResponseHref(
        listPath,
        surveyResponseQueryForPage(query, page + 1),
    );

    return (
        <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <Typography level="body3" className="text-muted-foreground">
                Stranica {page} od {pageCount} · ukupno {totalCount} odgovora
            </Typography>
            <div className="flex gap-2">
                <Button
                    disabled={page <= 1}
                    href={previousHref}
                    size="sm"
                    variant="outlined"
                >
                    Prethodna
                </Button>
                <Button
                    disabled={page >= pageCount}
                    href={nextHref}
                    size="sm"
                    variant="outlined"
                >
                    Sljedeća
                </Button>
            </div>
        </div>
    );
}
