/**
 * Napojnica
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface Napojnica {
    /** IznosType|string|pattern,whiteSpace */
    iznosNapojnice?: string;
    /** NacinPlacanjaType|string|G,K,T,O */
    nacinPlacanjaNapojnice?: string;
}
