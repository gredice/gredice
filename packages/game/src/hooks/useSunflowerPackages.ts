import { clientAuthenticated } from '@gredice/client';
import { useQuery } from '@tanstack/react-query';

export const sunflowerPackageKeys = [
    'accounts',
    'current',
    'sunflowers',
    'packages',
];

export async function fetchSunflowerPackageCatalog() {
    const response =
        await clientAuthenticated().api.accounts.current.sunflowers.packages.$get();
    if (response.status === 401) {
        return null;
    }
    if (!response.ok) {
        throw new Error(
            `Failed to fetch sunflower packages: ${response.status} ${response.statusText}`,
        );
    }
    return response.json();
}

export type SunflowerPackageCatalog = NonNullable<
    Awaited<ReturnType<typeof fetchSunflowerPackageCatalog>>
>;
export type SunflowerPackageData = SunflowerPackageCatalog['packages'][0];

export function useSunflowerPackages() {
    return useQuery({
        queryKey: sunflowerPackageKeys,
        queryFn: fetchSunflowerPackageCatalog,
        retry: false,
        staleTime: 1000 * 60 * 5,
    });
}
