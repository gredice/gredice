import type { Signature } from './Signature';
import type { Zaglavlje } from './Zaglavlje';

/**
 * DohvatiRadnoVrijemeZahtjev
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface DohvatiRadnoVrijemeZahtjev {
    /** Zaglavlje */
    Zaglavlje?: Zaglavlje;
    /** OibType|string|length,pattern */
    Oib?: string;
    /** OznPoslProstoraType|string|minLength,maxLength,pattern */
    OznPosPr?: string;
    /** string|REDOVNO,IZNIMKE,SVE */
    VrstaRadnogVremena?: string;
    /** OibType|string|length,pattern */
    OibOper?: string;
    /** Signature */
    Signature?: Signature;
}
