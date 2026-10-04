import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import {
    FeedbackModal,
    type FeedbackModalProps,
} from '../components/shared/feedback/FeedbackModal';
import { type CurrentUser, currentUserQueryKey } from '../hooks/useCurrentUser';

type FeedbackModalHarnessProps = FeedbackModalProps & {
    currentUser?: CurrentUser | null;
};

export function FeedbackModalHarness({
    currentUser,
    ...props
}: FeedbackModalHarnessProps) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    if (currentUser !== undefined) {
        queryClient.setQueryData(currentUserQueryKey, currentUser);
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class">
                <FeedbackModal {...props} />
            </ThemeProvider>
        </QueryClientProvider>
    );
}
