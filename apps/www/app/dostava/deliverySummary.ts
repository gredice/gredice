import {
    deliveryPricePerKilometre,
    maximumDeliveryDistanceKilometres,
} from '@gredice/js/delivery';
import { formatPrice } from '../../lib/formatPrice';

/**
 * Short, factual summary of how Gredice works, rendered at the top of the
 * delivery page so search engines and AI assistants can quote it accurately.
 *
 * Every claim here has to stay supported by the rest of the delivery page.
 */
export const deliverySummaryHeadingId = 'gredice-ukratko';

export const deliverySummaryHeading = 'Gredice ukratko';

export const deliverySummaryLead =
    'Gredice je digitalni vrt za korisnike u Zagrebu. Kroz aplikaciju biraš ' +
    'što ćeš posaditi u svoju vlastitu gredicu, pratiš rast biljaka i ' +
    'naručuješ berbu. Nakon berbe dostavljamo svježe povrće iz tvoje gredice ' +
    'na adresu u Zagrebu ili ga besplatno preuzimaš osobno u Zagrebu.';

export const deliverySummaryFacts = [
    'Dostava svježeg povrća na adresu u Zagrebu je besplatna.',
    `Izvan Zagreba dostava se naplaćuje ${formatPrice(deliveryPricePerKilometre)} po kilometru, do ${maximumDeliveryDistanceKilometres} km i samo unutar Hrvatske.`,
    'Osobno preuzimanje na lokaciji Gredice HQ u Zagrebu je besplatno.',
    'Dostava se zakazuje najmanje 48 sati unaprijed, u 2-satnim terminima.',
] as const;
