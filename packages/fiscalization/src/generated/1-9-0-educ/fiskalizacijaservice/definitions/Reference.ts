import type { DigestMethod } from './DigestMethod';
import type { Transforms } from './Transforms';

/**
 * Reference
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface Reference {
    /** Transforms */
    Transforms?: Transforms;
    /** DigestMethod */
    DigestMethod?: DigestMethod;
    /** DigestValueType|base64Binary */
    DigestValue?: string;
}
