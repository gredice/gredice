import { PoDogovoru } from "./PoDogovoru";
import { Jednokratno } from "./Jednokratno";
import { Dvokratno } from "./Dvokratno";
import { ParniNeparni } from "./ParniNeparni";

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
