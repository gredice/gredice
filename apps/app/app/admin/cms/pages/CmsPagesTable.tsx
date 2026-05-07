import { cmsPagePublicPath, type SelectCmsPage } from '@gredice/storage';
import { LocalDateTime } from '@gredice/ui/LocalDateTime';
import { Table } from '@signalco/ui-primitives/Table';
import { Typography } from '@signalco/ui-primitives/Typography';
import Link from 'next/link';
import { NoDataPlaceholder } from '../../../../components/shared/placeholders/NoDataPlaceholder';
import { KnownPages } from '../../../../src/KnownPages';
import { CmsPageStateChip } from './CmsPageStateChip';

export function CmsPagesTable({ pages }: { pages: SelectCmsPage[] }) {
    return (
        <Table>
            <Table.Header>
                <Table.Row>
                    <Table.Head>Naslov</Table.Head>
                    <Table.Head>Putanja</Table.Head>
                    <Table.Head>Status</Table.Head>
                    <Table.Head>Objavljeno</Table.Head>
                    <Table.Head>Izmjene</Table.Head>
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {pages.length === 0 && (
                    <Table.Row>
                        <Table.Cell colSpan={5}>
                            <NoDataPlaceholder />
                        </Table.Cell>
                    </Table.Row>
                )}
                {pages.map((page) => (
                    <Table.Row key={page.id}>
                        <Table.Cell>
                            <Link href={KnownPages.CmsPage(page.id)}>
                                <Typography>{page.title}</Typography>
                            </Link>
                        </Table.Cell>
                        <Table.Cell>
                            <Typography secondary>
                                {cmsPagePublicPath(page)}
                            </Typography>
                        </Table.Cell>
                        <Table.Cell>
                            <CmsPageStateChip state={page.state} />
                        </Table.Cell>
                        <Table.Cell>
                            <Typography secondary>
                                {page.publishedAt ? (
                                    <LocalDateTime time={false}>
                                        {page.publishedAt}
                                    </LocalDateTime>
                                ) : (
                                    '-'
                                )}
                            </Typography>
                        </Table.Cell>
                        <Table.Cell>
                            <Typography secondary>
                                <LocalDateTime time={false}>
                                    {page.updatedAt}
                                </LocalDateTime>
                            </Typography>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </Table.Body>
        </Table>
    );
}
