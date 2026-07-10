import {
    type SuncokretPlantDetailTab,
    type SuncokretRaisedBedDetailTab,
    type SuncokretSettingsSection,
    type SuncokretUiContext,
    suncokretSettingsSections,
} from '@gredice/js/ai';

export type SuncokretContextSuggestion = {
    label: string;
    prompt: string;
};

const settingsConversationLabels: Record<SuncokretSettingsSection, string> = {
    generalno: 'moj profil',
    postignuca: 'moja postignuća',
    suncokreti: 'moje Suncokrete',
    dostava: 'postavke dostave',
    obavijesti: 'moje obavijesti',
    preporuke: 'moje preporuke',
    vrt: 'postavke vrta',
    korisnici: 'korisnike računa',
    igra: 'postavke igre',
    sigurnost: 'sigurnosne postavke',
    zvuk: 'postavke zvuka',
};

export function isSuncokretSettingsSection(
    value: string | null | undefined,
): value is SuncokretSettingsSection {
    return suncokretSettingsSections.some((section) => section === value);
}

export function resolveSuncokretUiContext({
    raisedBedName,
    settingsSection,
}: {
    raisedBedName?: string | null;
    settingsSection?: string | null;
}): SuncokretUiContext {
    if (settingsSection) {
        return {
            surface: 'settings',
            section: isSuncokretSettingsSection(settingsSection)
                ? settingsSection
                : undefined,
        };
    }

    return raisedBedName ? { surface: 'raised-bed' } : { surface: 'garden' };
}

export function suncokretConversationLabel({
    gardenName,
    raisedBedName,
    settingsSection,
}: {
    gardenName?: string | null;
    raisedBedName?: string | null;
    settingsSection?: string | null;
}) {
    if (settingsSection) {
        return isSuncokretSettingsSection(settingsSection)
            ? settingsConversationLabels[settingsSection]
            : 'postavke';
    }

    return raisedBedName ?? gardenName ?? 'moj vrt';
}

const raisedBedDetailLabels: Record<SuncokretRaisedBedDetailTab, string> = {
    diary: 'dnevnik gredice',
    operations: 'radnje za gredicu',
    info: 'informacije o gredici',
};

const plantDetailLabels: Record<SuncokretPlantDetailTab, string> = {
    lifecycle: 'biljku',
    diary: 'dnevnik biljke',
    operations: 'radnje za biljku',
};

export function suncokretContextConversationLabel({
    gardenName,
    plantName,
    raisedBedName,
    uiContext,
}: {
    gardenName?: string | null;
    plantName?: string | null;
    raisedBedName?: string | null;
    uiContext: SuncokretUiContext;
}) {
    switch (uiContext.surface) {
        case 'weather':
            return uiContext.view === 'forecast'
                ? 'vremensku prognozu'
                : 'trenutno vrijeme';
        case 'raised-bed-details':
            return `${raisedBedDetailLabels[uiContext.tab]}${raisedBedName ? ` "${raisedBedName}"` : ''}`;
        case 'plant-details':
            return `${plantDetailLabels[uiContext.tab]}${plantName ? ` "${plantName}"` : ''}`;
        default:
            return suncokretConversationLabel({
                gardenName,
                raisedBedName,
                settingsSection:
                    uiContext.surface === 'settings'
                        ? uiContext.section
                        : undefined,
            });
    }
}

export function suncokretContextSuggestions(
    uiContext: SuncokretUiContext,
): SuncokretContextSuggestion[] {
    switch (uiContext.surface) {
        case 'weather':
            return uiContext.view === 'forecast'
                ? [
                      {
                          label: 'Pripremi vrt za prognozu',
                          prompt: 'Kako da pripremim vrt za nadolazeću vremensku prognozu?',
                      },
                      {
                          label: 'Odaberi najbolje dane za radove',
                          prompt: 'Koji su dani najbolji za radove u vrtu prema prognozi?',
                      },
                      {
                          label: 'Provjeri rizike za biljke',
                          prompt: 'Postoje li u prognozi vremenski rizici za moje biljke?',
                      },
                  ]
                : [
                      {
                          label: 'Procijeni današnje vrijeme',
                          prompt: 'Kako današnje vrijeme utječe na moj vrt?',
                      },
                      {
                          label: 'Provjeri vremenska upozorenja',
                          prompt: 'Trebam li nešto napraviti zbog današnjih vremenskih upozorenja?',
                      },
                      {
                          label: 'Predloži današnje radove',
                          prompt: 'Koje radove u vrtu ima smisla napraviti danas s obzirom na vrijeme?',
                      },
                  ];
        case 'raised-bed-details':
            if (uiContext.tab === 'diary') {
                return [
                    {
                        label: 'Sažmi dnevnik gredice',
                        prompt: 'Sažmi što se nedavno događalo na ovoj gredici.',
                    },
                    {
                        label: 'Pronađi obrasce i probleme',
                        prompt: 'Vidiš li u dnevniku ove gredice ponavljajuće probleme ili važne obrasce?',
                    },
                    {
                        label: 'Predloži sljedeći korak',
                        prompt: 'Što bi prema dnevniku trebao biti sljedeći korak za ovu gredicu?',
                    },
                ];
            }
            if (uiContext.tab === 'operations') {
                return [
                    {
                        label: 'Odaberi najvažnije radnje',
                        prompt: 'Koje su radnje sada najvažnije za ovu gredicu?',
                    },
                    {
                        label: 'Složi plan za ovaj tjedan',
                        prompt: 'Složi plan radnji za ovu gredicu za ovaj tjedan.',
                    },
                    {
                        label: 'Objasni koju radnju odabrati',
                        prompt: 'Pomozi mi odabrati odgovarajuću radnju za ovu gredicu.',
                    },
                ];
            }
            return [
                {
                    label: 'Objasni stanje gredice',
                    prompt: 'Objasni mi trenutno stanje i osnovne podatke ove gredice.',
                },
                {
                    label: 'Reci što trebam pratiti',
                    prompt: 'Koje podatke i promjene trebam pratiti na ovoj gredici?',
                },
                {
                    label: 'Predloži poboljšanja',
                    prompt: 'Što mogu poboljšati na ovoj gredici?',
                },
            ];
        case 'plant-details':
            if (uiContext.tab === 'diary') {
                return [
                    {
                        label: 'Sažmi dnevnik biljke',
                        prompt: 'Sažmi povijest i nedavne događaje za ovu biljku.',
                    },
                    {
                        label: 'Provjeri zabrinjavajuće promjene',
                        prompt: 'Ima li u dnevniku ove biljke zabrinjavajućih promjena?',
                    },
                    {
                        label: 'Predloži sljedeći korak',
                        prompt: 'Što je sljedeći korak za ovu biljku prema dnevniku?',
                    },
                ];
            }
            if (uiContext.tab === 'operations') {
                return [
                    {
                        label: 'Predloži radnju za biljku',
                        prompt: 'Koju radnju ova biljka sada najviše treba?',
                    },
                    {
                        label: 'Odredi što je najhitnije',
                        prompt: 'Što je trenutno najhitnije napraviti za ovu biljku?',
                    },
                    {
                        label: 'Složi plan njege',
                        prompt: 'Složi kratak plan njege ove biljke za ovaj tjedan.',
                    },
                ];
            }
            return [
                {
                    label: 'Procijeni napredak biljke',
                    prompt: 'Kako napreduje ova biljka i je li njezin razvoj uredan?',
                },
                {
                    label: 'Objasni trenutnu fazu',
                    prompt: 'Objasni mi trenutnu fazu razvoja ove biljke.',
                },
                {
                    label: 'Predloži sljedeću fazu njege',
                    prompt: 'Što ovoj biljci treba u sljedećoj fazi razvoja?',
                },
            ];
        case 'settings':
            return [
                {
                    label: 'Pomozi mi s ovom sekcijom',
                    prompt: 'Objasni mi što mogu napraviti u ovoj sekciji.',
                },
                {
                    label: 'Preporuči postavke',
                    prompt: 'Koje postavke ovdje preporučuješ za moj vrt?',
                },
                {
                    label: 'Objasni mogućnosti',
                    prompt: 'Objasni mi najvažnije mogućnosti u ovoj sekciji.',
                },
            ];
        case 'raised-bed':
            return [
                {
                    label: 'Sažmi stanje gredice',
                    prompt: 'Sažmi stanje ove gredice i predloži sljedeće korake.',
                },
                {
                    label: 'Složi plan za ovaj tjedan',
                    prompt: 'Koje radnje su najvažnije za ovu gredicu ovaj tjedan?',
                },
                {
                    label: 'Predloži što posaditi',
                    prompt: 'Što mogu posaditi sljedeće na ovoj gredici?',
                },
            ];
        case 'garden':
            return [
                {
                    label: 'Sažmi stanje vrta',
                    prompt: 'Sažmi stanje mog vrta i predloži sljedeće korake.',
                },
                {
                    label: 'Složi plan za ovaj tjedan',
                    prompt: 'Koje radnje su najvažnije ovaj tjedan?',
                },
                {
                    label: 'Predloži što posaditi',
                    prompt: 'Što mogu posaditi sljedeće?',
                },
            ];
    }
}

export function estimateSuncokretTextTokens(text: string) {
    return text.length > 0 ? Math.max(1, Math.ceil(text.length / 4)) : 0;
}

export function resolveSuncokretVisibleUsage({
    dailyUsageTokens,
    streamingText,
}: {
    dailyUsageTokens: number | null;
    streamingText: string;
}) {
    const streamingTokenEstimate = estimateSuncokretTextTokens(streamingText);
    if (dailyUsageTokens == null && streamingTokenEstimate === 0) {
        return null;
    }

    return {
        approximate: streamingTokenEstimate > 0,
        tokens: (dailyUsageTokens ?? 0) + streamingTokenEstimate,
    };
}

export function formatSuncokretTokenUsage(tokens: number, approximate = false) {
    const normalizedTokens = Math.max(0, Math.round(tokens));
    const formatted = new Intl.NumberFormat('hr-HR', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(normalizedTokens);
    const tokenLabel = normalizedTokens === 1 ? 'token' : 'tokena';

    return `Danas korišteno ${approximate ? '≈' : ''}${formatted} ${tokenLabel}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function suncokretUsageFromMetadata(metadata: unknown) {
    if (!isRecord(metadata) || !isRecord(metadata.suncokret)) {
        return null;
    }

    const { requestId, usage } = metadata.suncokret;
    if (typeof requestId !== 'string' || !isRecord(usage)) {
        return null;
    }

    const totalTokens = usage.totalTokens;
    if (
        typeof totalTokens !== 'number' ||
        !Number.isFinite(totalTokens) ||
        totalTokens < 0
    ) {
        return null;
    }

    return {
        requestId,
        totalTokens: Math.round(totalTokens),
    };
}
