import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { PlantFurtherReading } from '../app/biljke/[alias]/PlantFurtherReading';
import { PlantRelationshipsSection } from '../app/biljke/[alias]/PlantRelationshipsSection';

export function PlantRelationshipsHarness({
    entityTypeName,
    populated = false,
}: {
    entityTypeName: 'plant' | 'plantSort';
    populated?: boolean;
}) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" forcedTheme="light">
                <main className="mx-auto max-w-5xl space-y-8 p-4">
                    <h1>Bob</h1>
                    <PlantRelationshipsSection
                        editTarget={{
                            entityTypeName,
                            entityId: 7,
                            publicPath:
                                entityTypeName === 'plant'
                                    ? '/biljke/bob'
                                    : '/biljke/bob/sorte/aguadulce',
                        }}
                        relationships={
                            populated
                                ? {
                                      companions: [
                                          {
                                              id: 12,
                                              slug: 'bosiljak',
                                              name: 'Bosiljak',
                                              relationship: 'companion',
                                          },
                                      ],
                                  }
                                : undefined
                        }
                    />
                    <PlantFurtherReading />
                </main>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
