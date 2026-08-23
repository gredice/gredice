import type { Metadata } from 'next';
import { OAuthCallbackStatus } from '../../../../components/auth/OAuthCallbackStatus';

export const metadata: Metadata = {
    title: 'Facebook prijava',
    robots: {
        index: false,
        follow: false,
    },
};

export default function FacebookCallbackPage() {
    return <OAuthCallbackStatus provider="Facebook" />;
}
