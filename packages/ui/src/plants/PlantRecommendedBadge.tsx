import { ThumbsUp } from "@signalco/ui-icons";

const sharedSpanClasses = "rounded bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";

const sizeClasses = {
    sm: {
        span: "px-1 py-0.5 text-xs",
        icon: "inline size-3 mb-1 mr-0.5"
    },
    md: {
        span: "px-2 py-1 text-sm",
        icon: "inline size-4 mb-1 mr-0.5"
    },
    lg: {
        span: "px-3 py-1.5 text-base",
        icon: "inline size-5 mb-1 mr-1"
    }
};

export function PlantRecommendedBadge({ isRecommended, size = "md" }: { isRecommended: boolean | null | undefined, size?: "sm" | "md" | "lg" }) {
    if (!isRecommended) {
        return null;
    }

    const { span, icon } = sizeClasses[size] || sizeClasses.md;
    const spanClassName = `${sharedSpanClasses} ${span}`;

    return (
        <span className={spanClassName}>
            <ThumbsUp className={icon} />
            Vrijeme za sijanje
        </span>
    );
}