import { Card, CardHeader, CardOverflow, CardTitle } from '@gredice/ui/Card';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';
import {
    AutomationDefinitionStatusIndicator,
    AutomationRunStatusIndicator,
} from './AutomationStatusIndicator';
import type { AutomationDefinitionListItem } from './types';

export function AutomationDefinitionsList({
    definitions,
}: {
    definitions: AutomationDefinitionListItem[];
}) {
    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>Definicije</CardTitle>
            </CardHeader>
            <CardOverflow>
                {definitions.length === 0 ? (
                    <div className="p-4">
                        <NoDataPlaceholder>
                            Nema automatizacija za odabrane filtre.
                        </NoDataPlaceholder>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {definitions.map((definition) => {
                            const latestRun = definition.latestRun;
                            const failedCount = definition.failedRunsCount;

                            return (
                                <li key={definition.id} className="px-4 py-3">
                                    <div className="grid min-w-0 gap-1.5">
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <Link
                                                href={KnownPages.Automation(
                                                    definition.id,
                                                )}
                                                className="min-w-0 truncate font-medium text-primary hover:underline"
                                            >
                                                {definition.name}
                                            </Link>
                                            <AutomationDefinitionStatusIndicator
                                                className="shrink-0"
                                                status={definition.status}
                                            />
                                        </div>

                                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                            <span className="min-w-0 max-w-full truncate">
                                                {definition.key}
                                            </span>
                                            {latestRun ? (
                                                <span className="inline-flex items-center gap-1.5">
                                                    <AutomationRunStatusIndicator
                                                        className="text-xs"
                                                        status={
                                                            latestRun.status
                                                        }
                                                    />
                                                    <LocalDateTime>
                                                        {latestRun.createdAt}
                                                    </LocalDateTime>
                                                </span>
                                            ) : (
                                                <span>Nema izvođenja</span>
                                            )}
                                            {failedCount > 0 ? (
                                                <span className="font-medium text-red-700 dark:text-red-300">
                                                    Greške: {failedCount}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </CardOverflow>
        </Card>
    );
}
