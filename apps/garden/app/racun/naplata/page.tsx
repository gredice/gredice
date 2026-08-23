import type { Metadata } from 'next';
import { BillingPageClient } from './BillingPageClient';

export const metadata: Metadata = {
    title: 'Računi i plaćanja | Gredice',
};

export default function BillingPage() {
    return <BillingPageClient />;
}
