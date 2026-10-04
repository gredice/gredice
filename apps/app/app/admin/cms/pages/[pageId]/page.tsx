import { notFound, redirect } from 'next/navigation';
import { KnownPages } from '../../../../../src/KnownPages';

export const dynamic = 'force-dynamic';

export default async function CmsPageLegacyDetailsPage({
    params,
}: {
    params: Promise<{ pageId: string }>;
}) {
    const { pageId } = await params;
    const id = Number.parseInt(pageId, 10);

    if (Number.isNaN(id)) {
        notFound();
    }

    redirect(KnownPages.CmsPageEdit(id));
}
