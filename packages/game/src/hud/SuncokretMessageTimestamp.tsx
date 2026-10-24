export function SuncokretMessageTimestamp({ timestamp }: { timestamp: Date }) {
    return (
        <div className="mb-4 text-center text-xs text-muted-foreground">
            <time dateTime={timestamp.toISOString()}>
                {timestamp.toLocaleString('hr-HR', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                })}
            </time>
        </div>
    );
}
