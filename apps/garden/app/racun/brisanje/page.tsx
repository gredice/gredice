import { Suspense } from 'react';
import { DeleteAccountCard } from './DeleteAccountCard';

export default function AccountDeleteConfirmPage() {
    return (
        <Suspense>
            <DeleteAccountCard />
        </Suspense>
    );
}
