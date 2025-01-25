import Link from "next/link";

export default function DebugPage() {
    return (
        <div>
            <h1>Debug Page</h1>
            <p>This is a debug page.</p>
            <ul className="[&>li]:list-disc [&>li]:ml-4">
                <li>
                    <Link href="/debug/weather">Weather</Link>
                </li>
            </ul>
        </div>
    )
}