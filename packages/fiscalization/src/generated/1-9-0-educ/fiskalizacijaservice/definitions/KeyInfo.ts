import { KeyValue } from "./KeyValue";
import { RetrievalMethod } from "./RetrievalMethod";
import { X509Data } from "./X509Data";
import { PgpData } from "./PgpData";
import { SpkiData } from "./SpkiData";

/**
 * KeyInfo
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface KeyInfo {
    /** a */
    0?: string;
    /** n */
    1?: string;
    /** y */
    2?: string;
    /** string */
    KeyName?: string;
    /** KeyValue */
    KeyValue?: KeyValue;
    /** RetrievalMethod */
    RetrievalMethod?: RetrievalMethod;
    /** X509Data */
    X509Data?: X509Data;
    /** PGPData */
    PGPData?: PgpData;
    /** SPKIData */
    SPKIData?: SpkiData;
    /** string */
    MgmtData?: string;
}
