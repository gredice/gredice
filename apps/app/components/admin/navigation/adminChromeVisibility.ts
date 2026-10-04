export function isAdminChromeHiddenPath(pathname: string) {
    return /^\/admin\/cms\/pages\/[^/]+\/preview\/?$/u.test(pathname);
}
