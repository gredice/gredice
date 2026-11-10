import { UierReview, UierReviewToggle } from '@gredice/ui/UierReview';
import { LoginPanel } from '../components/auth/LoginPanel';

export function UierReviewStory({
    project = 'www',
    signedOut = false,
}: {
    project?: 'www' | 'news' | 'delivery';
    signedOut?: boolean;
}) {
    if (signedOut) return <LoginPanel returnTarget="/" />;

    return (
        <>
            <UierReview project={project} />
            <UierReviewToggle />
        </>
    );
}
