import type { CanonicalizationMethod } from './CanonicalizationMethod';
import type { Reference } from './Reference';
import type { SignatureMethod } from './SignatureMethod';

/**
 * SignedInfo
 * @targetNSAlias `ds`
 * @targetNamespace `http://www.w3.org/2000/09/xmldsig#`
 */
export interface SignedInfo {
    /** CanonicalizationMethod */
    CanonicalizationMethod?: CanonicalizationMethod;
    /** SignatureMethod */
    SignatureMethod?: SignatureMethod;
    /** Reference */
    Reference?: Reference;
}
