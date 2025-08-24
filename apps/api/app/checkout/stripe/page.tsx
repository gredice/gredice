import { redirect } from 'next/navigation';

export default async function CheckoutPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = (await searchParams) || {};
    const success = params.status === 'success';
    if (success) {
        redirect('https://vrt.gredice.com/?placanje=uspijesno');
    } else {
        redirect('https://vrt.gredice.com');
    }
}
