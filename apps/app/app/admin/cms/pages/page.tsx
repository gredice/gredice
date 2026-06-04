import { getCmsPages } from '@gredice/storage';
import { Card, CardOverflow } from '@gredice/ui/Card';
import { Add } from '@gredice/ui/icons';
import { Row } from '@gredice/ui/Row';
import { Stack } from '@gredice/ui/Stack';
import Link from 'next/link';
import { AdminPageHeader } from '../../../../components/admin/navigation';
import { auth } from '../../../../lib/auth/auth';
import { KnownPages } from '../../../../src/KnownPages';
import { CmsPagesTable } from './CmsPagesTable';

export const dynamic = 'force-dynamic';

export default async function CmsPagesPage() {
    await auth(['admin']);

    const pages = await getCmsPages();

    return (
        <Stack spacing={4}>
            <AdminPageHeader
                actions={
                    <Row spacing={2} className="flex-wrap justify-end">
                        <Link href={KnownPages.CmsPageCreate}>
                            <Row
                                spacing={2}
                                className="text-sm font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            >
                                <Add className="size-4" />
                                <span>Nova stranica</span>
                            </Row>
                        </Link>
                        <Link href={KnownPages.CmsPageCreateTemplate('blog')}>
                            <Row
                                spacing={2}
                                className="text-sm font-medium px-3 py-2 rounded-md border bg-background hover:bg-muted transition-colors"
                            >
                                <Add className="size-4" />
                                <span>Blog objava</span>
                            </Row>
                        </Link>
                        <Link
                            href={KnownPages.CmsPageCreateTemplate('changelog')}
                        >
                            <Row
                                spacing={2}
                                className="text-sm font-medium px-3 py-2 rounded-md border bg-background hover:bg-muted transition-colors"
                            >
                                <Add className="size-4" />
                                <span>Changelog zapis</span>
                            </Row>
                        </Link>
                    </Row>
                }
            />
            <Card>
                <CardOverflow>
                    <CmsPagesTable pages={pages} />
                </CardOverflow>
            </Card>
        </Stack>
    );
}
