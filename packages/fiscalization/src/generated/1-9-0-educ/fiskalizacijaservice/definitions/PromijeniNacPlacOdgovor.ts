import type { Greske } from './Greske';
import type { PorukaOdgovora } from './PorukaOdgovora';
import type { Signature } from './Signature';
import type { Zaglavlje1 } from './Zaglavlje1';

/**
 * PromijeniNacPlacOdgovor
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface PromijeniNacPlacOdgovor {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje1;
    /** PorukaOdgovora */
    PorukaOdgovora?: PorukaOdgovora;
    /** Greske */
    Greske?: Greske;
    /** Signature */
    Signature?: Signature;
}
