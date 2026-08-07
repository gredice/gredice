import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import {
    CommunityEntitySuggestionButton,
    type CommunityEntitySuggestionButtonProps,
} from '../components/community-edits/CommunityEntitySuggestionButton';

export function CommunityEntitySuggestionButtonHarness(
    props: CommunityEntitySuggestionButtonProps,
) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class">
                <CommunityEntitySuggestionButton {...props} />
            </ThemeProvider>
        </QueryClientProvider>
    );
}
