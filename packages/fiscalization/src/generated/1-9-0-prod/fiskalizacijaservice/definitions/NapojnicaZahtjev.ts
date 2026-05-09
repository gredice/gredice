import type { Racun2 } from './Racun2';
import type { Signature } from './Signature';
import type { Zaglavlje } from './Zaglavlje';

/**
 * NapojnicaZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface NapojnicaZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** Racun */
    Racun?: Racun2;
    /** Signature */
    Signature?: Signature;
}
