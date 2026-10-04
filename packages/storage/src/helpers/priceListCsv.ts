type PriceListEntry = {
    key: string;
    name: string;
    price: number;
    currency: string;
    unit: string;
    available: boolean;
    specialSale: string;
    anchorPrice: { price: number; date: string } | null;
};

function cell(value: string) {
    // Quoting preserves delimiters/newlines; the prefix prevents spreadsheet
    // formula evaluation in names supplied through the CMS.
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
}

export function priceListCsv(entries: ReadonlyArray<PriceListEntry>) {
    const rows = [
        [
            'Sifra',
            'Naziv usluge',
            'Jedinica mjere',
            'Maloprodajna cijena',
            'Valuta',
            'Posebni oblik prodaje',
            'Naziv posebnog oblika prodaje',
            'Sidrena cijena',
            'Datum sidrene cijene',
            'Dostupnost',
        ],
        ...entries.map((entry) => [
            entry.key,
            entry.name,
            entry.unit,
            entry.price.toFixed(2),
            entry.currency,
            entry.specialSale ? 'DA' : 'NE',
            entry.specialSale,
            entry.anchorPrice?.price.toFixed(2) ?? '',
            entry.anchorPrice?.date ?? '',
            entry.available ? 'DOSTUPNO' : 'NEDOSTUPNO',
        ]),
    ];
    return `\uFEFF${rows.map((row) => row.map(cell).join(';')).join('\r\n')}\r\n`;
}
