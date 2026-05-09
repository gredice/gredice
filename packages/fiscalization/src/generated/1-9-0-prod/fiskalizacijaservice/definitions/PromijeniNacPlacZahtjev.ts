import type { Racun1 } from './Racun1';
import type { Signature } from './Signature';
import type { Zaglavlje } from './Zaglavlje';

/**
 * PromijeniNacPlacZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface PromijeniNacPlacZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun1;
    /** Signature */
    Signature?: Signature;
}
