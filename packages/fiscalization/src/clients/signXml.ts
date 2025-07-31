import { SignedXml } from "xml-crypto";
import { getPkcs12KeyPair } from "../crypto";
import { WSDL } from 'soap';
import { readFileSync } from "node:fs";
import { RacunZahtjev } from "../generated/1-9-0-educ/fiskalizacijaservice";

async function wsdlObjectToXml(object: object) {
    // Load WSDL schema
    const version = '1-9-0';
    const env = 'educ';
    const wsdlPath = `./external/${version}-${env}/wsdl/FiskalizacijaService.wsdl`;
    const wsdl = new WSDL(readFileSync(wsdlPath, 'utf8'), wsdlPath, {
        strict: true,
        ignoredNamespaces: {
            override: true,
            namespaces: ['targetNamespace', 'typedNamespace'] // Default excluding `tns` namespace
        }
    });

    // Wait for WSDL to be ready
    await new Promise((resolve, reject) => wsdl.onReady((error) => {
        if (error) {
            console.error('WSDL error:', error);
            reject(error);
        } else {
            console.log('WSDL is ready');
            resolve(true);
        }
    }));

    return wsdl
        .objectToXML({ RacunZahtjev: object }, '', 'tns', 'http://www.apis-it.hr/fin/2012/types/f73', true)
        .replace('xmlns="http://www.apis-it.hr/fin/2012/types/f73"', '')
}

export async function signXml(request: RacunZahtjev, creds: { cert: string, password: string }) {
    const {
        certPem,
        keyPem,
        issuer,
        serialNumber
    } = getPkcs12KeyPair(creds.cert, creds.password);
    const racunXml = await wsdlObjectToXml(request);

    // 2. Sign the XML using xml-crypto
    try {
        // Create SignedXml instance
        const sig = new SignedXml({
            privateKey: keyPem,
            publicCert: certPem,
            canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
            signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
            getKeyInfoContent: () => {
                const strippedCert = certPem
                    .toString()
                    .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----/g, '')
                    .replace(/\s+/g, '');

                // Get all attributes and concat them to a string
                const issuerString =
                    `OU=${issuer.find(attr => attr.shortName === 'OU')?.value || ''},` +
                    `O=${issuer.find(attr => attr.shortName === 'O')?.value || ''},` +
                    `C=${issuer.find(attr => attr.shortName === 'C')?.value || ''}`;

                return (
                    `<X509Data>` +
                    ` <X509Certificate>${strippedCert}</X509Certificate>` +
                    ` <X509IssuerSerial>` +
                    `   <X509IssuerName>${issuerString}</X509IssuerName>` +
                    `   <X509SerialNumber>${serialNumber}</X509SerialNumber>` +
                    ` </X509IssuerSerial>` +
                    `</X509Data>`
                )
            }
        });

        // Add reference with transforms
        sig.addReference({
            xpath: "//*[local-name(.)='RacunZahtjev']",
            digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
            transforms: [
                "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
                "http://www.w3.org/2001/10/xml-exc-c14n#"
            ]
        });

        // Compute signature
        sig.computeSignature(racunXml, {
            location: {
                reference: "//*[local-name(.)='RacunZahtjev']",
                action: "append"
            }
        });

        return sig.getSignedXml()
    } catch (error: any) {
        console.error("Request signing failed:", error)
        const errorMessage = error.body ? JSON.stringify(error.body) : error.message
        throw new Error(`Request signing failed: ${errorMessage}`)
    }
}
