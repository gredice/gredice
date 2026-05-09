import type { Greske } from './Greske';
import type { PoslovniProstor } from './PoslovniProstor';
import type { Signature } from './Signature';
import type { Zaglavlje1 } from './Zaglavlje1';

/**
 * DohvatiRadnoVrijemeOdgovor
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface DohvatiRadnoVrijemeOdgovor {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje1;
    /** PoslovniProstor */
    PoslovniProstor?: PoslovniProstor;
    /** Greske */
    Greske?: Greske;
    /** Signature */
    Signature?: Signature;
}
