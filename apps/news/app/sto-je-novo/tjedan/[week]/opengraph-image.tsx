import { cmsOgImageContentType, cmsOgImageSize } from '@gredice/ui/cms';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { WeeklyChangelogOgImage } from '../../../../components/WeeklyChangelogOgImage';
import { getDailyChangelogEntries } from '../../../../lib/news';
import { findChangelogWeek } from '../../../../lib/weeklyChangelog';

export const alt = 'Tjedni pregled promjena u Gredicama';
export const size = cmsOgImageSize;
export const contentType = cmsOgImageContentType;
export const revalidate = 86_400;

export default async function WeeklyChangelogOpenGraphImage({
    params,
}: {
    params: Promise<{ week: string }>;
}) {
    const { week: weekKey } = await params;
    const entries = await getDailyChangelogEntries();
    const week = findChangelogWeek(entries, weekKey);
    if (!week) {
        notFound();
    }

    return new ImageResponse(<WeeklyChangelogOgImage week={week} />, {
        ...size,
    });
}
