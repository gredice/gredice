import type { Greske } from './Greske';
import type { Racun } from './Racun';
import type { Signature } from './Signature';
import type { Zaglavlje1 } from './Zaglavlje1';

/**
 * ProvjeraOdgovor
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface ProvjeraOdgovor {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje1;
    /** Racun */
    Racun?: Racun;
    /** Greske */
    Greske?: Greske;
    /** Signature */
    Signature?: Signature;
}
