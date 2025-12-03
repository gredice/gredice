import type { Racun3 } from './Racun3';
import type { Signature } from './Signature';
import type { Zaglavlje } from './Zaglavlje';

/**
 * PromijeniPodatkeRacunaZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface PromijeniPodatkeRacunaZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun3;
    /** Signature */
    Signature?: Signature;
}
