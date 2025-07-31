import forge from 'node-forge';

export function getPkcs12KeyPair(p12Buffer: string, password: string) {
    const p12Asn1 = forge.asn1.fromDer(p12Buffer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Private key
    const index = forge.pki.oids['pkcs8ShroudedKeyBag'];
    const keyBags = forge.pki.oids['keyBag'];
    if (index === undefined || keyBags === undefined) {
        throw new Error('index not defined');
    }
    const keyData = p12.getBags({
        bagType: forge.pki.oids['pkcs8ShroudedKeyBag'],
    });
    if (keyData === undefined) {
        throw new Error('Key data is undefined');
    }
    const pkcs8Key = keyData[index]?.at(0) ?? keyData[keyBags]?.at(0);
    if (!pkcs8Key?.key) {
        throw new Error('Unable to get private key.');
    }

    // Certificate
    const bagType = forge.pki.oids['certBag'];
    if (bagType === undefined) {
        throw new Error();
    }
    const certData = p12.getBags({ bagType })[bagType] ?? [];
    const { cert } = certData.at(0) ?? {};
    if (cert === undefined) {
        throw new Error();
    }

    // Convert to PEM format
    const keyPem = forge.pki.privateKeyToPem(pkcs8Key.key)
    const certPem = forge.pki.certificateToPem(cert)

    return {
        keyPem,
        certPem,
        issuer: cert.subject.attributes,
        serialNumber: BigInt('0x' + cert.serialNumber).toString(),
    };

    // Cast the OID to a string to avoid index-type errors
    // const keyBagType = forge.pki.oids.pkcs8ShroudedKeyBag as string;
    // const allKeyBags = p12.getBags({
    //     bagType: keyBagType
    // });

    // var bags = p12.getBags({
    //     friendlyName: 'cn=FISKAL 1',
    //     bagType: forge.pki.oids.keyBags
    // });
    // console.log(JSON.stringify(p12, null, 4));

    // Index using the string variable
    // const keyBags = allKeyBags[keyBagType];
    // if (!keyBags || keyBags.length === 0) {
    //     throw new Error('No private key found in the PKCS#12 file.');
    // }

    // const bag = keyBags[0];
    // if (!bag) {
    //     throw new Error('No bag found in the key bags.');
    // }
    // const privateKey = bag.key as forge.pki.rsa.PrivateKey;

    // // Get the public key
    // const publicKey = forge.pki.setRsaPublicKey(privateKey.n, privateKey.e);

    // const privateKeyPem = forge.pki.privateKeyToPem(privateKey);
    // const publicKeyPem = forge.pki.publicKeyToPem(publicKey);

    // const certBagType = forge.pki.oids.certBag as string;
    // const allCertBags = p12.getBags({
    //     bagType: certBagType
    // });

    // const certBags = allCertBags[certBagType];
    // if (!certBags || certBags.length === 0) {
    //     throw new Error('No certificate found in the PKCS#12 file.');
    // }
    // const certBag = certBags[0];
    // if (!certBag) {
    //     throw new Error('No bag found in the certificate bags.');
    // }
    // console.log('Certificate Bag:', certBag);

    // const cert = certBag.cert as forge.pki.Certificate;
    // // const certPem = forge.pem.encode({
    // //     type: 'CERTIFICATE',
    // //     body: cert.toAsn1().getBytes()
    // // });

    // const pem = forge.pki.publicKeyToRSAPublicKeyPem(publicKey);
    // // const privateKeyInfo = forge.pki.wrapRsaPrivateKey(rsaPrivateKey);
    // // const pem = forge.pki.privateKeyInfoToPem(privateKeyInfo);

    // return { privateKey, publicKey, privateKeyPem, publicKeyPem, cert, certPem: pem };
}
