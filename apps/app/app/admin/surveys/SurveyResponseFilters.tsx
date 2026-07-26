import type { SelectSurveyVersion } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import Link from 'next/link';
import { KnownPages } from '../../../src/KnownPages';
import { SurveyResponseFilterField } from './SurveyResponseFilterField';
import {
    type SurveyResponseQuery,
    surveyResponseHref,
    surveyResponseQueryForPage,
} from './surveyResponseQuery';

const fieldClassName =
    'h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30';

export function SurveyResponseFilters({
    query,
    surveyId,
    versions,
}: {
    query: SurveyResponseQuery;
    surveyId: string;
    versions: SelectSurveyVersion[];
}) {
    const hasFilters = [
        query.versionId,
        query.from,
        query.to,
        query.accountId,
        query.userId,
        query.monthKey,
        query.context,
        query.source,
    ].some(Boolean);
    const exportHref = surveyResponseHref(
        KnownPages.SurveyResponsesExport(surveyId),
        surveyResponseQueryForPage(query, 1),
    );

    return (
        <form
            action={KnownPages.SurveyResponses(surveyId)}
            className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
            method="get"
        >
            <SurveyResponseFilterField
                htmlFor="survey-response-version"
                label="Verzija"
            >
                <select
                    className={fieldClassName}
                    defaultValue={query.versionId ?? ''}
                    id="survey-response-version"
                    name="versionId"
                >
                    <option value="">Sve verzije</option>
                    {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                            v{version.versionNumber} · {version.title}
                        </option>
                    ))}
                </select>
            </SurveyResponseFilterField>
            <SurveyResponseFilterField
                htmlFor="survey-response-source"
                label="Izvor"
            >
                <select
                    className={fieldClassName}
                    defaultValue={query.source ?? ''}
                    id="survey-response-source"
                    name="source"
                >
                    <option value="">Svi izvori</option>
                    <option value="in_app">U aplikaciji</option>
                    <option value="typeform">Typeform</option>
                    <option value="admin_import">Administratorski uvoz</option>
                </select>
            </SurveyResponseFilterField>
            <SurveyResponseFilterField
                htmlFor="survey-response-from"
                label="Predano od"
            >
                <input
                    className={fieldClassName}
                    defaultValue={query.from ?? ''}
                    id="survey-response-from"
                    name="from"
                    type="date"
                />
            </SurveyResponseFilterField>
            <SurveyResponseFilterField
                htmlFor="survey-response-to"
                label="Predano do"
            >
                <input
                    className={fieldClassName}
                    defaultValue={query.to ?? ''}
                    id="survey-response-to"
                    name="to"
                    type="date"
                />
            </SurveyResponseFilterField>
            <SurveyResponseFilterField
                htmlFor="survey-response-account"
                label="ID računa"
            >
                <input
                    className={fieldClassName}
                    defaultValue={query.accountId ?? ''}
                    id="survey-response-account"
                    name="accountId"
                    placeholder="ID računa"
                />
            </SurveyResponseFilterField>
            <SurveyResponseFilterField
                htmlFor="survey-response-user"
                label="ID korisnika"
            >
                <input
                    className={fieldClassName}
                    defaultValue={query.userId ?? ''}
                    id="survey-response-user"
                    name="userId"
                    placeholder="ID korisnika"
                />
            </SurveyResponseFilterField>
            <SurveyResponseFilterField
                htmlFor="survey-response-month"
                label="Mjesec dostave"
            >
                <input
                    className={fieldClassName}
                    defaultValue={query.monthKey ?? ''}
                    id="survey-response-month"
                    name="monthKey"
                    placeholder="2026-07"
                    pattern="\d{4}-(0[1-9]|1[0-2])"
                />
            </SurveyResponseFilterField>
            <SurveyResponseFilterField
                htmlFor="survey-response-context"
                label="Kontekst"
            >
                <input
                    className={fieldClassName}
                    defaultValue={query.context ?? ''}
                    id="survey-response-context"
                    name="context"
                    placeholder="Ključ, kontekst ili metapodaci"
                />
            </SurveyResponseFilterField>
            <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-4">
                <Button type="submit" variant="outlined">
                    Primijeni filtre
                </Button>
                <a
                    className="relative inline-flex h-10 min-w-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    download
                    href={exportHref}
                >
                    Izvezi filtrirane odgovore (CSV)
                </a>
                {hasFilters ? (
                    <Link
                        className="text-sm font-medium text-primary hover:underline"
                        href={KnownPages.SurveyResponses(surveyId)}
                    >
                        Očisti filtre
                    </Link>
                ) : null}
            </div>
        </form>
    );
}
