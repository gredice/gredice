import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { PlantHealthSection } from '../app/biljke/[alias]/PlantHealthSection';
import { PlantTips } from '../app/biljke/[alias]/PlantTips';

export function PlantCommunitySuggestionsHarness({
    populated = false,
}: {
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
                    <PlantTips
                        plant={{
                            id: 7,
                            information: {
                                name: 'Bob',
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
                        publicPath="/biljke/bob"
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
                        plantId={7}
                        plantName="Bob"
                        publicPath="/biljke/bob"
                    />
                </main>
            </ThemeProvider>
        </QueryClientProvider>
    );
}
