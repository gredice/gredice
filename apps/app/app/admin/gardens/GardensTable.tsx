import type { SelectGarden } from '@gredice/storage';
import { Chip } from '@gredice/ui/Chip';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Typography } from '@gredice/ui/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';

type GardenRow = Pick<
    SelectGarden,
    'accountId' | 'createdAt' | 'id' | 'isPublic' | 'name'
>;

type GardensTableProps = {
    gardens: GardenRow[];
    showAccountColumn?: boolean;
    showCreatedTime?: boolean;
    emptyLabel?: string;
};

export function GardensTable({
    gardens,
    showAccountColumn = true,
    showCreatedTime = false,
    emptyLabel = 'Nema vrtova',
}: GardensTableProps) {
    if (gardens.length === 0) {
        return (
            <div className="p-4">
                <NoDataPlaceholder>{emptyLabel}</NoDataPlaceholder>
            </div>
        );
    }

    return (
        <ul className="divide-y">
            {gardens.map((garden) => (
                <li
                    key={garden.id}
                    className="px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4"
                >
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <Link
                                href={KnownPages.Garden(garden.id)}
                                className="min-w-0 break-words text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                                {garden.name}
                            </Link>
                            {garden.isPublic ? (
                                <Chip
                                    color="success"
                                    size="sm"
                                    variant="soft"
                                    className="mt-1"
                                >
                                    Public
                                </Chip>
                            ) : null}
                        </div>
                        <div className="flex min-w-0 flex-col gap-1 text-left sm:items-end sm:text-right">
                            {showAccountColumn && (
                                <Typography
                                    component="div"
                                    level="body3"
                                    className="flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1 gap-y-0.5 text-muted-foreground sm:justify-end"
                                >
                                    <span className="shrink-0">Račun</span>
                                    <Link
                                        href={KnownPages.Account(
                                            garden.accountId,
                                        )}
                                        title={garden.accountId}
                                        className="min-w-0 font-mono text-primary underline-offset-4 [overflow-wrap:anywhere] hover:underline"
                                    >
                                        {garden.accountId}
                                    </Link>
                                </Typography>
                            )}
                            <Typography
                                component="div"
                                level="body3"
                                className="whitespace-nowrap text-muted-foreground"
                            >
                                <LocalDateTime time={showCreatedTime}>
                                    {garden.createdAt}
                                </LocalDateTime>
                            </Typography>
                        </div>
                    </div>
                </li>
            ))}
        </ul>
    );
}
