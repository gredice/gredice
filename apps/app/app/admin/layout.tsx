import { Stack } from "@signalco/ui-primitives/Stack";
import { PropsWithChildren, Suspense } from "react";
import { PageNav } from "@signalco/ui/Nav";

export default function AdminLayout({ children }: PropsWithChildren) {
    return (
        <Stack>
            <PageNav
                logo="Gredice Admin"
                links={[
                    { href: '/admin', text: 'Dashboard' },
                    { href: '/admin/directories', text: 'Zapisi' },
                ]} />
            <main className="mt-16">
                <Suspense>
                    {children}
                </Suspense>
            </main>
        </Stack>
    )
}