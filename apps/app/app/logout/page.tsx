import { LogoutForm } from '../admin/logout/LogoutForm';

export default function LogoutPage() {
    return (
        <div className="grow bg-secondary/40">
            <main className="flex min-h-screen items-center justify-center p-4">
                <LogoutForm />
            </main>
        </div>
    );
}
