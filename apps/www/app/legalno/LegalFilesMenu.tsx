'use client';

import { List } from '@signalco/ui-primitives/List';
import { ListItem } from '@signalco/ui-primitives/ListItem';
import { usePathname } from 'next/navigation';
import { KnownPages } from '../../src/KnownPages';

export function LegalFilesMenu() {
    const pathname = usePathname();

    return (
        <List variant="outlined" className="bg-card">
            <ListItem
                selected={pathname === KnownPages.LegalPrivacy}
                href={KnownPages.LegalPrivacy}
                label={'Politika privatnosti'}
                variant="outlined"
            />
            <ListItem
                selected={pathname === KnownPages.LegalTerms}
                href={KnownPages.LegalTerms}
                label={'Uvjeti korištenja'}
                variant="outlined"
            />
            <ListItem
                selected={pathname === KnownPages.LegalCookies}
                href={KnownPages.LegalCookies}
                label={'Politika kolačića'}
                variant="outlined"
            />
            <ListItem
                selected={pathname === KnownPages.LegalLicense}
                href={KnownPages.LegalLicense}
                label={'Licenca izvornog koda'}
                variant="outlined"
            />
            <ListItem
                selected={pathname === KnownPages.LegalThirdParty}
                href={KnownPages.LegalThirdParty}
                label={'Treće strane'}
                variant="outlined"
            />
            <ListItem
                selected={pathname === KnownPages.LegalCompany}
                href={KnownPages.LegalCompany}
                label={'Tvrtka'}
                variant="outlined"
            />
        </List>
    );
}
