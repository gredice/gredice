import type { Racun } from './Racun';
import type { Signature } from './Signature';
import type { Zaglavlje } from './Zaglavlje';

/**
 * ProvjeraZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface ProvjeraZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun;
    /** Signature */
    Signature?: Signature;
}
