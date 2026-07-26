import { Button } from '@gredice/ui/Button';
import { Typography } from '@gredice/ui/Typography';
import { KnownPages } from '../../../src/KnownPages';
import {
    type SurveyResponseQuery,
    surveyResponseHref,
    surveyResponsePaginationPages,
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
    const { nextPage, previousPage } = surveyResponsePaginationPages(
        page,
        pageCount,
    );
    const previousHref =
        previousPage === null
            ? null
            : surveyResponseHref(
                  listPath,
                  surveyResponseQueryForPage(query, previousPage),
              );
    const nextHref =
        nextPage === null
            ? null
            : surveyResponseHref(
                  listPath,
                  surveyResponseQueryForPage(query, nextPage),
              );

    return (
        <div className="flex flex-col gap-3 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <Typography level="body3" className="text-muted-foreground">
                Stranica {page} od {pageCount} · ukupno {totalCount} odgovora
            </Typography>
            <div className="flex gap-2">
                {previousHref === null ? (
                    <Button disabled size="sm" variant="outlined">
                        Prethodna
                    </Button>
                ) : (
                    <Button href={previousHref} size="sm" variant="outlined">
                        Prethodna
                    </Button>
                )}
                {nextHref === null ? (
                    <Button disabled size="sm" variant="outlined">
                        Sljedeća
                    </Button>
                ) : (
                    <Button href={nextHref} size="sm" variant="outlined">
                        Sljedeća
                    </Button>
                )}
            </div>
        </div>
    );
}
