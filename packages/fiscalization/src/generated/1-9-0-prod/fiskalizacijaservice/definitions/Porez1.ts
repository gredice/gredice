/**
 * Porez
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface Porez1 {
    /** string|minLength,maxLength */
    Naziv?: string;
    /** StopaType|string|pattern,whiteSpace */
    Stopa?: string;
    /** IznosType|string|pattern,whiteSpace */
    Osnovica?: string;
    /** IznosType|string|pattern,whiteSpace */
    Iznos?: string;
}
