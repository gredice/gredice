import type { SelectSurveyVersion } from '@gredice/storage';
import { Button } from '@gredice/ui/Button';
import { Stack } from '@gredice/ui/Stack';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { KnownPages } from '../../../src/KnownPages';
import { StatisticsPeriodFilter } from '../statistics/StatisticsPeriodFilter';
import type { StatisticsPeriodKey } from '../statistics/statisticsPeriod';
import { SurveyResponseFilterField } from './SurveyResponseFilterField';
import type { SurveyResponseQuery } from './surveyResponseQuery';

const fieldClassName =
    'h-10 w-full rounded-md border bg-background px-3 text-sm outline-hidden focus:border-ring focus:ring-2 focus:ring-ring/30';

export function SurveyAnalyticsFilters({
    maxDate,
    period,
    pickerFrom,
    pickerTo,
    query,
    rangeLabel,
    surveyId,
    versions,
}: {
    maxDate: string;
    period: StatisticsPeriodKey;
    pickerFrom: string;
    pickerTo: string;
    query: SurveyResponseQuery;
    rangeLabel: string;
    surveyId: string;
    versions: SelectSurveyVersion[];
}) {
    const hasFilters =
        period !== 'current-year' ||
        [
            query.versionId,
            query.accountId,
            query.userId,
            query.monthKey,
            query.context,
            query.source,
        ].some(Boolean);

    return (
        <Stack spacing={4}>
            <StatisticsPeriodFilter
                initialPeriod={period}
                initialFrom={pickerFrom}
                initialTo={pickerTo}
                maxDate={maxDate}
                rangeLabel={rangeLabel}
                label="Razdoblje analitike"
            />

            <form
                action={KnownPages.SurveyStatistics(surveyId)}
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                method="get"
            >
                {period !== 'current-year' ? (
                    <input name="period" type="hidden" value={period} />
                ) : null}
                {period === 'custom' && query.from && query.to ? (
                    <>
                        <input name="from" type="hidden" value={query.from} />
                        <input name="to" type="hidden" value={query.to} />
                    </>
                ) : null}
                <SurveyResponseFilterField
                    htmlFor="survey-analytics-version"
                    label="Verzija"
                >
                    <select
                        className={fieldClassName}
                        defaultValue={query.versionId ?? ''}
                        id="survey-analytics-version"
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
                    htmlFor="survey-analytics-source"
                    label="Izvor odgovora"
                >
                    <select
                        className={fieldClassName}
                        defaultValue={query.source ?? ''}
                        id="survey-analytics-source"
                        name="source"
                    >
                        <option value="">Svi izvori</option>
                        <option value="in_app">U aplikaciji</option>
                        <option value="typeform">Typeform</option>
                        <option value="admin_import">
                            Administratorski uvoz
                        </option>
                    </select>
                </SurveyResponseFilterField>
                <SurveyResponseFilterField
                    htmlFor="survey-analytics-account"
                    label="ID računa"
                >
                    <input
                        className={fieldClassName}
                        defaultValue={query.accountId ?? ''}
                        id="survey-analytics-account"
                        name="accountId"
                        placeholder="ID računa"
                    />
                </SurveyResponseFilterField>
                <SurveyResponseFilterField
                    htmlFor="survey-analytics-user"
                    label="ID korisnika"
                >
                    <input
                        className={fieldClassName}
                        defaultValue={query.userId ?? ''}
                        id="survey-analytics-user"
                        name="userId"
                        placeholder="ID korisnika"
                    />
                </SurveyResponseFilterField>
                <SurveyResponseFilterField
                    htmlFor="survey-analytics-month"
                    label="Mjesec dostave"
                >
                    <input
                        className={fieldClassName}
                        defaultValue={query.monthKey ?? ''}
                        id="survey-analytics-month"
                        name="monthKey"
                        pattern="\d{4}-(0[1-9]|1[0-2])"
                        placeholder="2026-07"
                    />
                </SurveyResponseFilterField>
                <SurveyResponseFilterField
                    htmlFor="survey-analytics-context"
                    label="Kontekst"
                >
                    <input
                        className={fieldClassName}
                        defaultValue={query.context ?? ''}
                        id="survey-analytics-context"
                        name="context"
                        placeholder="Ključ, kontekst ili metapodaci"
                    />
                </SurveyResponseFilterField>
                <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-3">
                    <Button type="submit" variant="outlined">
                        Primijeni filtre
                    </Button>
                    {hasFilters ? (
                        <Link
                            className="text-sm font-medium text-primary hover:underline"
                            href={KnownPages.SurveyStatistics(surveyId)}
                        >
                            Očisti filtre
                        </Link>
                    ) : null}
                </div>
            </form>

            <Typography level="body3" className="text-muted-foreground">
                Razdoblje za tok koristi datum stvaranja dodjele, a za odgovore
                datum predaje. Izvor odgovora ne mijenja dodjele u toku jer
                dodjele nemaju izvor. Pretraga konteksta za tok koristi samo
                dodjelu, dok za odgovore uključuje i njihove metapodatke. Mjesec
                dostave za odgovor zahtijeva povezanu dodjelu.
            </Typography>
        </Stack>
    );
}
