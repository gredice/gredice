import { Stack } from "@signalco/ui-primitives/Stack";
import { PropsWithChildren } from "react";
import { PageNav } from "@signalco/ui/Nav";

export default function AdminLayout({ children }: PropsWithChildren) {
    return (
        <Stack>
            <PageNav
                logo="Gredice Admin"
                links={[
                    { href: '/admin', text: 'Dashboard' },
                    { href: '/admin/plants', text: 'Biljke' },
                ]} />
            <main className="mt-16">
                {children}
            </main>
        </Stack>
    )
}