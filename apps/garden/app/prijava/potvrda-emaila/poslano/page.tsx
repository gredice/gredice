import { EmailSentCard } from '../../EmailSentCard';

export default function VerifyEmailEmailSentPage() {
    return (
        <div className="flex min-h-dvh items-center justify-center px-4 py-6">
            <EmailSentCard purpose="email-verification" />
        </div>
    );
}
