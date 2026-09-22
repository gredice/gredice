import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { PlantHealthSection } from '../app/biljke/[alias]/PlantHealthSection';
import { PlantTips } from '../app/biljke/[alias]/PlantTips';

export function PlantCommunitySuggestionsHarness({
    populated = false,
    plantId = 7,
    plantName = 'Bob',
    publicPath = '/biljke/bob',
}: {
    populated?: boolean;
    plantId?: number;
    plantName?: string;
    publicPath?: string;
}) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" forcedTheme="light">
                <main className="mx-auto max-w-5xl space-y-8 p-4">
                    <h1>{plantName}</h1>
                    <PlantTips
                        plant={{
                            id: plantId,
                            information: {
                                name: plantName,
                                tip: populated
                                    ? [
                                          {
                                              header: 'Zaštita od vjetra',
                                              content:
                                                  'Visoke biljke po potrebi podupri kolcima i uzicom.',
                                          },
                                      ]
                                    : undefined,
                            },
                        }}
                        publicPath={publicPath}
                    />
                    <PlantHealthSection
                        health={
                            populated
                                ? {
                                      diseases: [
                                          {
                                              id: 10,
                                              kind: 'disease',
                                              name: 'Čokoladna pjegavost boba',
                                              slug: 'cokoladna-pjegavost-boba',
                                              shortDescription:
                                                  'Gljivična bolest koja stvara smeđe pjege na listovima.',
                                          },
                                      ],
                                      pests: [
                                          {
                                              id: 11,
                                              kind: 'pest',
                                              name: 'Lisne uši',
                                              slug: 'lisne-usi',
                                              shortDescription:
                                                  'Sitni kukci koji sišu biljne sokove na mladim izbojima.',
                                          },
                                      ],
                                  }
                                : undefined
                        }
                        plantId={plantId}
                        plantName={plantName}
                        publicPath={publicPath}
                    />
                </main>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
