export function plantFieldStatusLabel(status: string | undefined) {
    switch (status) {
        case 'new':
            return {
                shortLabel: 'Čeka sijanje',
                label: 'Biljka čeka na sijanje',
                description:
                    'Sijanje biljke će biti odrađeno u što kraćem roku.',
            };
        case 'planned':
            return {
                shortLabel: 'Planirana',
                label: 'Biljka je planirana za sijanje',
                description:
                    'Termin sijanja je određen i biljka čeka svoj red.',
            };
        case 'sowed':
            return {
                shortLabel: 'Posijana',
                label: 'Biljka je posijana',
                description: 'Sjeme je posijano i čeka klijanje.',
            };
        case 'notSprouted':
            return {
                shortLabel: 'Nije proklijala',
                label: 'Biljka nije proklijala',
                description: 'Sjeme nije proklijalo u očekivanom vremenu.',
            };
        case 'sprouted':
            return {
                shortLabel: 'Proklijala',
                label: 'Biljka je proklijala',
                description:
                    'Sjeme je uspješno proklijalo i biljka je krenula rasti.',
            };
        case 'ready':
            return {
                shortLabel: 'Spremna za berbu',
                label: 'Biljka je spremna za berbu',
                description:
                    'Biljka i/ili plodovi su dozreli i mogu se ubirati.',
            };
        case 'harvested':
            return {
                shortLabel: 'Ubrana',
                label: 'Biljka je ubrana',
                description: 'Svi plodovi su ubrani i biljka se može ukloniti.',
            };
        case 'died':
            return {
                shortLabel: 'Neuspjela',
                label: 'Biljka je neuspjela',
                description: 'Iako je proklijala, biljka je neuspjela.',
            };
        case 'removed':
            return {
                shortLabel: 'Uklonjena',
                label: 'Biljka je uklonjena',
                description: 'Biljka je uklonjena iz polja.',
            };
        default:
            return {
                shortLabel: 'Nepoznato',
                label: `Nepoznato stanje: ${status}`,
                description: 'Stanje biljke nije definirano.',
            };
    }
}
