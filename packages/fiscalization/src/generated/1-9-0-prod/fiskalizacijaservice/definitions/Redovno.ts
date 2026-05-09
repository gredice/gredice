import type { Dvokratno } from './Dvokratno';
import type { Jednokratno } from './Jednokratno';
import type { ParniNeparni } from './ParniNeparni';
import type { PoDogovoru } from './PoDogovoru';

/**
 * Redovno
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface Redovno {
    /** DatumType|string|length,pattern */
    DatumOd?: string;
    /** DatumType|string|length,pattern */
    DatumDo?: string;
    /** String200Type|string|minLength,maxLength */
    Napomena?: string;
    /** PoDogovoru */
    PoDogovoru?: PoDogovoru;
    /** Jednokratno[] */
    Jednokratno?: Array<Jednokratno>;
    /** Dvokratno[] */
    Dvokratno?: Array<Dvokratno>;
    /** ParniNeparni[] */
    ParniNeparni?: Array<ParniNeparni>;
}
