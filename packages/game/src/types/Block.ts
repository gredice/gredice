export type Block = {
    id: string;
    name: string;
    rotation: number;
    variant?: number | null;
    message?: string | null;
    /**
     * Sunflowers paid for this block, which recycling refunds. Only the
     * garden's own account receives it. Null or missing when the client
     * cannot know the refund: legacy and pack blocks, unsaved blocks, the
     * local sandbox and mock gardens.
     */
    paidSunflowers?: number | null;
};
