export function isSelectedPath(
    pathname: string,
    href: string,
    strictMatch = false,
) {
    if (strictMatch) {
        return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
}

export function includesSelectedPath(pathname: string, hrefs: string[]) {
    return hrefs.some((href) => isSelectedPath(pathname, href));
}
