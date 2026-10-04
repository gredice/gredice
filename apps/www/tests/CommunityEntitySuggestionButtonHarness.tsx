import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { PlantSortSuggestionCard } from '../app/biljke/[alias]/PlantSortSuggestionCard';
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
                {props.kind === 'plantSort' ? (
                    <PlantSortSuggestionCard
                        basePlantId={props.parentPlantId}
                        basePlantName={props.parentPlantName}
                    />
                ) : (
                    <CommunityEntitySuggestionButton {...props} />
                )}
            </ThemeProvider>
        </QueryClientProvider>
    );
}
