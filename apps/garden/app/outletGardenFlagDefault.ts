type OutletGardenFlagEnvironment = {
    NODE_ENV?: string;
    VERCEL_ENV?: string;
};

export function outletGardenEnabledByDefault(
    environment: OutletGardenFlagEnvironment,
) {
    return (
        environment.NODE_ENV === 'development' ||
        environment.VERCEL_ENV === 'preview'
    );
}
