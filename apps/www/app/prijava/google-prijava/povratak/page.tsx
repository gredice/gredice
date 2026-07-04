import type { Metadata } from 'next';
import { OAuthCallbackStatus } from '../../../../components/auth/OAuthCallbackStatus';

export const metadata: Metadata = {
    title: 'Google prijava',
};

export default function GoogleCallbackPage() {
    return <OAuthCallbackStatus provider="Google" />;
}
