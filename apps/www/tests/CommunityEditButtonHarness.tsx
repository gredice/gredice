import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import type { CommunityEditButtonProps } from '../components/community-edits/CommunityEditButton';
import { CommunityEditButton } from '../components/community-edits/CommunityEditButton';

export function CommunityEditButtonHarness(props: CommunityEditButtonProps) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class">
                <CommunityEditButton {...props} />
            </ThemeProvider>
        </QueryClientProvider>
    );
}
