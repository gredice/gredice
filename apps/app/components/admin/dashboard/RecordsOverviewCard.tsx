import { croatianPlural } from '@gredice/js/i18n';
import { cx } from '@gredice/ui/utils';
import { KnownPages } from '../../../src/KnownPages';
import type { getAnalyticsData } from './actions';
import { DashboardChartCard } from './DashboardChartCard';
import { DashboardChartLegend } from './DashboardChartLegend';
import { dashboardChartColors } from './dashboardChartColors';
import {
    formatDashboardNumber,
    formatDashboardPercent,
} from './dashboardFormat';

const VISIBLE_ENTITY_TYPES = 5;

function incompleteRecordsLabel(count: number) {
    return `${formatDashboardNumber(count)} ${croatianPlural(count, {
        one: 'nepotpun',
        few: 'nepotpuna',
        many: 'nepotpunih',
    })}`;
}

export function RecordsOverviewCard({
    entities,
}: {
    entities: Awaited<ReturnType<typeof getAnalyticsData>>['entities'];
}) {
    const rows = entities
        .map((entity) => {
            const incomplete = Math.min(
                entity.count,
                entity.incompleteDraftCount + entity.incompletePublishedCount,
            );
            return {
                key: entity.entityTypeName,
                label: entity.label,
                count: entity.count,
                incomplete,
                complete: entity.count - incomplete,
            };
        })
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count);
    const visibleRows = rows.slice(0, VISIBLE_ENTITY_TYPES);
    const hiddenTypesCount = rows.length - visibleRows.length;
    const maxCount = visibleRows[0]?.count ?? 0;
    const total = rows.reduce((sum, row) => sum + row.count, 0);
    const incomplete = rows.reduce((sum, row) => sum + row.incomplete, 0);

    return (
        <DashboardChartCard
            title="Zapisi"
            href={KnownPages.RecordsStatistics}
            value={formatDashboardNumber(total)}
            detail={
                total > 0
                    ? `${incompleteRecordsLabel(incomplete)} · ${formatDashboardPercent((total - incomplete) / total)} potpuno`
                    : 'Nema zapisa'
            }
            legend={
                total > 0 ? (
                    <DashboardChartLegend
                        items={[
                            {
                                key: 'complete',
                                label: 'Potpuni',
                                colorClassName: dashboardChartColors.primary,
                            },
                            {
                                key: 'incomplete',
                                label: 'Nepotpuni',
                                colorClassName: dashboardChartColors.secondary,
                            },
                        ]}
                    />
                ) : null
            }
        >
            {visibleRows.length > 0 ? (
                <div className="flex flex-col gap-2">
                    <ul className="flex flex-col gap-2">
                        {visibleRows.map((row) => (
                            <li key={row.key} className="flex flex-col gap-1">
                                <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                                    <span className="truncate">
                                        {row.label}
                                    </span>
                                    <span className="shrink-0">
                                        <span className="font-medium text-foreground">
                                            {formatDashboardNumber(row.count)}
                                        </span>
                                        {row.incomplete > 0
                                            ? ` · ${incompleteRecordsLabel(row.incomplete)}`
                                            : null}
                                    </span>
                                </div>
                                <div aria-hidden className="h-2">
                                    <div
                                        className="flex h-full min-w-1 gap-0.5 overflow-hidden rounded-full"
                                        style={{
                                            width: `${(row.count / maxCount) * 100}%`,
                                        }}
                                    >
                                        {row.complete > 0 ? (
                                            <div
                                                className={cx(
                                                    'h-full',
                                                    dashboardChartColors.primary,
                                                )}
                                                style={{
                                                    flexGrow: row.complete,
                                                    flexBasis: 0,
                                                }}
                                            />
                                        ) : null}
                                        {row.incomplete > 0 ? (
                                            <div
                                                className={cx(
                                                    'h-full min-w-0.5',
                                                    dashboardChartColors.secondary,
                                                )}
                                                style={{
                                                    flexGrow: row.incomplete,
                                                    flexBasis: 0,
                                                }}
                                            />
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {hiddenTypesCount > 0 ? (
                        <p className="text-xs text-muted-foreground">
                            + još {formatDashboardNumber(hiddenTypesCount)}{' '}
                            {croatianPlural(hiddenTypesCount, {
                                one: 'tip zapisa',
                                few: 'tipa zapisa',
                                many: 'tipova zapisa',
                            })}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </DashboardChartCard>
    );
}
