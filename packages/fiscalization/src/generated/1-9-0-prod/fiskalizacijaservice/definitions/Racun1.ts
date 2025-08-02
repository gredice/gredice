import { BrRac } from "./BrRac";
import { Pdv } from "./Pdv";
import { Pnp } from "./Pnp";
import { OstaliPor } from "./OstaliPor";
import { Naknade } from "./Naknade";

/**
 * Racun
 * @targetNSAlias `tns`
 * @targetNamespace `http://www.apis-it.hr/fin/2012/types/f73`
 */
export interface Racun1 {
    /** OibType|string|length,pattern */
    Oib?: string;
    /** boolean */
    USustPdv?: boolean;
    /** DatumVrijemeType|string|length,pattern */
    DatVrijeme?: string;
    /** OznakaSlijednostiType|string|N,P */
    OznSlijed?: string;
    /** BrRac */
    BrRac?: BrRac;
    /** Pdv */
    Pdv?: Pdv;
    /** Pnp */
    Pnp?: Pnp;
    /** OstaliPor */
    OstaliPor?: OstaliPor;
    /** IznosType|string|pattern,whiteSpace */
    IznosOslobPdv?: string;
    /** IznosType|string|pattern,whiteSpace */
    IznosMarza?: string;
    /** IznosType|string|pattern,whiteSpace */
    IznosNePodlOpor?: string;
    /** Naknade */
    Naknade?: Naknade;
    /** IznosType|string|pattern,whiteSpace */
    IznosUkupno?: string;
    /** NacinPlacanjaType|string|G,K,T,O */
    NacinPlac?: string;
    /** OibType|string|length,pattern */
    OibOper?: string;
    /** string|pattern,length */
    ZastKod?: string;
    /** boolean */
    NakDost?: boolean;
    /** string|minLength,maxLength */
    ParagonBrRac?: string;
    /** string|minLength,maxLength */
    SpecNamj?: string;
    /** OibType|string|length,pattern */
    OibPrimateljaRacuna?: string;
    /** NacinPlacanjaType|string|G,K,T,O */
    PromijenjeniNacinPlac?: string;
}
