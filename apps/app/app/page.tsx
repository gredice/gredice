import { redirect } from 'next/navigation';
import { adminReviewRedirectUrl } from '../lib/uierReviewRedirect';

export default async function Home({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    redirect(adminReviewRedirectUrl(await searchParams));
}
