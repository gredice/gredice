import type { Metadata } from 'next';
import { OAuthCallbackStatus } from '../../../../components/auth/OAuthCallbackStatus';

export const metadata: Metadata = {
    title: 'Google prijava',
    robots: {
        index: false,
        follow: false,
    },
};

export default function GoogleCallbackPage() {
    return <OAuthCallbackStatus provider="Google" />;
}
