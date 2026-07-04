import type { Metadata } from 'next';
import { OAuthCallbackStatus } from '../../../../components/auth/OAuthCallbackStatus';

export const metadata: Metadata = {
    title: 'Facebook prijava',
};

export default function FacebookCallbackPage() {
    return <OAuthCallbackStatus provider="Facebook" />;
}
