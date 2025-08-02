import { SignedXml } from "xml-crypto";
import { getPkcs12KeyPair } from "../crypto";
import { RacunZahtjev } from "../generated/1-9-0-educ/fiskalizacijaservice";
import { Builder } from "xml2js";

const TNS = "http://www.apis-it.hr/fin/2012/types/f73"

async function wsdlObjectToXml(request: RacunZahtjev) {
    const racunZahtjevObject = {
        "tns:RacunZahtjev": {
            $: { "xmlns:tns": TNS, Id: "racun-zahtjev" },
            "tns:Zaglavlje": { "tns:IdPoruke": request.Zaglavlje?.IdPoruke, "tns:DatumVrijeme": request.Zaglavlje?.DatumVrijeme },
            "tns:Racun": {
                "tns:Oib": request.Racun?.Oib,
                "tns:USustPdv": request.Racun?.USustPdv,
                "tns:DatVrijeme": request.Racun?.DatVrijeme,
                "tns:OznSlijed": request.Racun?.OznSlijed,
                "tns:BrRac": {
                    "tns:BrOznRac": request.Racun?.BrRac?.BrOznRac,
                    "tns:OznPosPr": request.Racun?.BrRac?.OznPosPr,
                    "tns:OznNapUr": request.Racun?.BrRac?.OznNapUr,
                },
                "tns:IznosUkupno": request.Racun?.IznosUkupno,
                "tns:NacinPlac": request.Racun?.NacinPlac,
                "tns:OibOper": request.Racun?.OibOper,
                "tns:ZastKod": request.Racun?.ZastKod,
                "tns:NakDost": request.Racun?.NakDost ?? false, // Default to false if not provided
            },
        },
    }

    const builder = new Builder({ headless: true, renderOpts: { pretty: false } })
    return builder.buildObject(racunZahtjevObject);
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
