import { formatSunflowers } from '../utils/sunflowerPricing';

/**
 * Croatian copy for the block options pop-up, the remove confirmation, Move
 * and Expand. Sunflower history labels live in `SunflowersList.tsx`.
 */

const blockCountPluralRules = new Intl.PluralRules('hr');

type PluralForms = {
    one: string;
    few: string;
    other: string;
};

function selectPluralForm(count: number, forms: PluralForms) {
    const category = blockCountPluralRules.select(count);
    if (category === 'one') {
        return forms.one;
    }
    if (category === 'few') {
        return forms.few;
    }
    return forms.other;
}

const blockForms: PluralForms = {
    one: 'blok',
    few: 'bloka',
    other: 'blokova',
};

const newBlockAdjectiveForms: PluralForms = {
    one: 'novi',
    few: 'nova',
    other: 'novih',
};

/**
 * "1 blok", "2 bloka", "5 blokova"; with `adjective: 'novi'`
 * "1 novi blok", "2 nova bloka", "5 novih blokova".
 */
export function formatBlockCount(
    count: number,
    options: { adjective: 'novi' | null } = { adjective: null },
) {
    const noun = selectPluralForm(count, blockForms);
    return options.adjective === 'novi'
        ? `${count} ${selectPluralForm(count, newBlockAdjectiveForms)} ${noun}`
        : `${count} ${noun}`;
}

/** "🌻 1.250" with the HUD's number format. */
export function formatSunflowerChip(amount: number) {
    return `🌻 ${formatSunflowers(amount)}`;
}

function formatArea(width: number, depth: number) {
    return `${width} × ${depth}`;
}

export const blockOptionsToolbarCopy = {
    toolbarLabel: (label: string) => `Radnje za blok: ${label}`,
    actions: {
        expand: 'Proširi',
        rotate: 'Okreni',
        recycle: 'Recikliraj',
        /** Sandbox gardens delete instead of recycling. */
        delete: 'Obriši',
        move: 'Pomakni',
    },
    disabledReasons: {
        notExpandable: 'Ovaj predmet se ne može proširiti.',
        notRotatable: 'Ovaj predmet se ne može okretati.',
        notRemovable: 'Ovaj predmet se ne može ukloniti.',
        activeRaisedBed: 'Aktivna gredica ne može se ukloniti.',
        unsaved: 'Blok se još sprema.',
        expandPending: 'Pričekaj da se proširivanje spremi.',
        rotatePending: 'Okretanje se još sprema.',
    },
} as const;

export const blockRemoveCopy = {
    recycle: {
        title: 'Potvrdi recikliranje',
        header: (label: string) => `Recikliranje: ${label}`,
        confirm: 'Recikliraj',
    },
    delete: {
        title: 'Potvrdi brisanje',
        header: (label: string) => `Brisanje: ${label}`,
        confirm: 'Obriši',
    },
    cancel: 'Odustani',
    /**
     * `stackedCount`: blocks standing on the removed one, removed with it.
     * `cartItemCount`: cart items of a new raised bed that are removed too.
     * The stacked sentence uses no pronoun for `label`: labels are masculine,
     * feminine or plural ("Suha zemlja", "Kamene stube"), and "na njega"
     * would read as referring to "vrta".
     */
    body: ({
        cartItemCount = 0,
        label,
        stackedCount = 0,
    }: {
        cartItemCount?: number;
        label: string;
        stackedCount?: number;
    }) =>
        [
            `${label} će se ukloniti iz vrta.`,
            stackedCount > 0
                ? `Uklonit će se i predmeti postavljeni iznad (${stackedCount}).`
                : null,
            cartItemCount > 0
                ? `Uklonit će se i stavke iz košarice za ovu gredicu (${cartItemCount}).`
                : null,
        ]
            .filter((sentence) => sentence !== null)
            .join(' '),
    /**
     * Refund line for everything the confirmation removes (a stacked
     * segment included). Use `refund` only with the total the server will
     * actually give (the price paid per block, summed), `noRefund` when that
     * total is 0, and `refundUnknown` whenever any block's refund cannot be
     * known on the client (no stored paid price: legacy and pack-unit
     * blocks). `refundUnknown` claims no amount and no basis.
     */
    refund: (amount: number) =>
        `Dobit ćeš natrag ${formatSunflowerChip(amount)}.`,
    noRefund: 'Za ovo uklanjanje nema povrata suncokreta.',
    refundUnknown:
        'Povrat suncokreta, ako ga ima, vidjet ćeš nakon uklanjanja.',
    error: 'Uklanjanje nije uspjelo. Pokušaj ponovno.',
} as const;

export const blockMoveCopy = {
    carryTouch: 'Dodirni mjesto za spuštanje',
    carryMouse: 'Klikni mjesto za spuštanje (Esc za odustajanje)',
} as const;

export const blockExpandCopy = {
    region: 'Proširivanje bloka',
    title: (label: string) => `Proširi: ${label}`,
    area: (width: number, depth: number) =>
        `Područje ${formatArea(width, depth)}`,
    count: (count: number) => formatBlockCount(count, { adjective: 'novi' }),
    skipped: (count: number) => `Preskočena polja: ${count}`,
    totalLabel: 'Ukupno',
    /** Label of the balance the bar compares against (HUD balance, OPEN-4). */
    balanceLabel: 'Imaš',
    empty: 'Povuci ručku da označiš područje.',
    allSkipped: 'Sva označena polja su zauzeta ili na drugoj visini.',
    cap: (maxSide: number) =>
        `Najviše ${formatArea(maxSide, maxSide)} polja odjednom.`,
    /** `affordableCount`: how many copies the balance covers. */
    short: (affordableCount: number) =>
        affordableCount > 0
            ? `Nedovoljno suncokreta. Imaš dovoljno za ${formatBlockCount(affordableCount)}.`
            : 'Nedovoljno suncokreta.',
    nightOnly: 'Dostupno samo noću.',
    notForSale: 'Ovaj predmet se ne prodaje.',
    cancel: 'Odustani',
    confirm: 'Potvrdi postavljanje',
    pending: 'Provjera postavljanja…',
    success: (count: number) => `Postavljeno: ${formatBlockCount(count)}.`,
    close: 'Zatvori',
    gardenChanged:
        'Vrt se promijenio. Pregled je osvježen, provjeri broj blokova i potvrdi ponovno.',
    priceChanged:
        'Cijena se promijenila. Provjeri novi iznos i potvrdi ponovno.',
    areaTooLarge: 'Područje je preveliko. Smanji ga i potvrdi ponovno.',
    rateLimited:
        'Previše proširivanja u kratkom vremenu. Pokušaj ponovno za nekoliko minuta.',
    uncertain:
        'Potvrda nije stigla. Provjeri isti zahtjev; suncokreti se neće naplatiti dvaput.',
    retrySame: 'Provjeri isti zahtjev',
    discard: 'Odbaci',
    failed: 'Postavljanje nije uspjelo. Pokušaj ponovno.',
    /** A lost request checked again whose response was lost too. */
    stillUncertain: 'Potvrda ni ovaj put nije stigla.',
    /** Title of the receipt, and of a notice once no Expand is open. */
    receiptTitle: (label: string) => `Proširivanje: ${label}`,
    /** A request that ended without placing anything, after Expand closed. */
    notPlaced: 'Blokovi nisu postavljeni i suncokreti nisu potrošeni.',
    /** A stored request shown above a new Expand. */
    earlierRegion: 'Prethodno proširivanje',
    earlierTitle: (label: string, count: number) =>
        `Prethodno: ${label} · ${formatBlockCount(count, { adjective: 'novi' })}`,
    /** Why a new Expand cannot be confirmed while a request is stored. */
    earlierPending: 'Prvo provjeri ili odbaci prethodno proširivanje.',
    handle: (width: number, depth: number) =>
        `Ručka za proširivanje, ${formatArea(width, depth)}`,
} as const;

export const blockOptionsHelpCopy = {
    desktopHint: 'Radnje s blokom: drži klik na bloku i pusti bez pomicanja.',
    touchHint: 'Radnje s blokom: drži prst na bloku i pusti bez pomicanja.',
    pickupGesture: 'Drži i povuci',
    optionsLabel: 'Radnje s blokom',
    optionsGesture: 'Drži i pusti',
} as const;
