import type { PoslovniProstor } from './PoslovniProstor';
import type { Signature } from './Signature';
import type { Zaglavlje } from './Zaglavlje';

/**
 * PrijaviRadnoVrijemeZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface PrijaviRadnoVrijemeZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** PoslovniProstor */
    PoslovniProstor?: PoslovniProstor;
    /** Signature */
    Signature?: Signature;
}
