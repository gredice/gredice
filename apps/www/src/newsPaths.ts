const legacyWhatsNewPath = '/sto-je-novo';

export function canonicalLegacyNewsPathname(pathname: string) {
    if (
        pathname !== legacyWhatsNewPath &&
        !pathname.startsWith(`${legacyWhatsNewPath}/`)
    ) {
        return null;
    }

    return `/novosti${pathname}`;
}
