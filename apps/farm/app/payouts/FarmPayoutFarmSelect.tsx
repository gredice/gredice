'use client';

import { SelectItems } from '@gredice/ui/SelectItems';
import type { Route } from 'next';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type FarmPayoutFarmSelectProps = {
    farms: {
        id: number;
        name: string;
    }[];
    selectedFarmId: number;
};

export function FarmPayoutFarmSelect({
    farms,
    selectedFarmId,
}: FarmPayoutFarmSelectProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    return (
        <SelectItems
            className="w-full sm:max-w-xs"
            label="Farma"
            items={farms.map((farm) => ({
                value: farm.id.toString(),
                label: farm.name,
                title: farm.name,
            }))}
            value={selectedFarmId.toString()}
            onValueChange={(value) => {
                const nextParams = new URLSearchParams(searchParams.toString());
                nextParams.set('farmId', value);
                const nextHref =
                    `${pathname}?${nextParams.toString()}` as Route;
                router.replace(nextHref);
            }}
        />
    );
}
