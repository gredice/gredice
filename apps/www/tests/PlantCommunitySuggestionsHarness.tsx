import type { PlantData } from '@gredice/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { PlantHealthSection } from '../app/biljke/[alias]/PlantHealthSection';
import { PlantTips } from '../app/biljke/[alias]/PlantTips';

const additionalDiseases = [
    {
        id: 12,
        kind: 'disease',
        name: 'Druga bolest',
        slug: 'druga-bolest',
        shortDescription: 'Druga česta bolest.',
    },
    {
        id: 13,
        kind: 'disease',
        name: 'Treća bolest',
        slug: 'treca-bolest',
        shortDescription: 'Treća česta bolest.',
    },
] satisfies NonNullable<NonNullable<PlantData['health']>['diseases']>;

export function PlantCommunitySuggestionsHarness({
    populated = false,
    threeDiseases = false,
    plantId = 7,
    plantName = 'Bob',
    publicPath = '/biljke/bob',
}: {
    populated?: boolean;
    threeDiseases?: boolean;
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
                            populated || threeDiseases
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
                                          ...(threeDiseases
                                              ? additionalDiseases
                                              : []),
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
