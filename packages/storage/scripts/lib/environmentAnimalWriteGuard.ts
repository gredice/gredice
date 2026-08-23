type EnvironmentAnimalWriteOptions = {
    apply: boolean;
    target: string;
};

type EnvironmentAnimalWriteEnvironment = {
    GREDICE_DATABASE_ENVIRONMENT?: string;
    VERCEL_ENV?: string;
};

export function assertEnvironmentAnimalWriteAllowed(
    { apply, target }: EnvironmentAnimalWriteOptions,
    environment: EnvironmentAnimalWriteEnvironment = process.env,
) {
    if (!apply) {
        return;
    }
    if (target !== 'development') {
        throw new Error('Writes are restricted to --target development.');
    }

    const databaseEnvironment =
        environment.GREDICE_DATABASE_ENVIRONMENT?.trim();
    if (databaseEnvironment !== target) {
        throw new Error(
            'GREDICE_DATABASE_ENVIRONMENT=development must be configured alongside POSTGRES_URL before applying writes.',
        );
    }

    const vercelEnvironment = environment.VERCEL_ENV?.trim();
    if (vercelEnvironment && vercelEnvironment !== databaseEnvironment) {
        throw new Error(
            `Configured VERCEL_ENV is ${vercelEnvironment}; refusing a ${databaseEnvironment} database write.`,
        );
    }
}
