export type GardenLightRegistryEntry<Registration> = {
    instanceKey: string;
    registration: Registration;
};

export class GardenLightRegistryStore<Registration extends { key: string }> {
    private readonly registrations = new Map<string, Registration>();
    private nextRegistrationId = 0;

    getEntries(): GardenLightRegistryEntry<Registration>[] {
        return Array.from(
            this.registrations,
            ([instanceKey, registration]) => ({
                instanceKey,
                registration,
            }),
        );
    }

    register(registration: Registration) {
        const instanceKey = `${registration.key}:${this.nextRegistrationId}`;
        this.nextRegistrationId += 1;
        this.registrations.set(instanceKey, registration);
        let registered = true;

        return {
            instanceKey,
            unregister: () => {
                if (!registered) {
                    return;
                }

                registered = false;
                this.registrations.delete(instanceKey);
            },
        };
    }
}
