import type { SelectGarden } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Table } from '@gredice/ui/Table';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../src/KnownPages';

type GardenRow = Pick<SelectGarden, 'accountId' | 'createdAt' | 'id' | 'name'>;

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
    const columnCount = showAccountColumn ? 3 : 2;

    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naziv</Table.Head>
                    {showAccountColumn && <Table.Head>Račun</Table.Head>}
                    <Table.Head>Datum kreiranja</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {gardens.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={columnCount}>
                            <NoDataPlaceholder>{emptyLabel}</NoDataPlaceholder>
                        </Table.Cell>
                    </Table.Row>
                )}
                {gardens.map((garden) => (
                    <Table.Row key={garden.id}>
                        <Table.Cell>
                            <Link href={KnownPages.Garden(garden.id)}>
                                {garden.name}
                            </Link>
                        </Table.Cell>
                        {showAccountColumn && (
                            <Table.Cell>
                                <Link
                                    href={KnownPages.Account(garden.accountId)}
                                >
                                    {garden.accountId}
                                </Link>
                            </Table.Cell>
                        )}
                        <Table.Cell>
                            <LocalDateTime time={showCreatedTime}>
                                {garden.createdAt}
                            </LocalDateTime>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
