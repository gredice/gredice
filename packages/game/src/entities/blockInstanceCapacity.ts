const minimumBlockInstanceCapacity = 100;
const blockInstanceCapacityHeadroom = 10;

export function resolveBlockInstanceCapacity(instanceCount: number) {
    if (instanceCount <= minimumBlockInstanceCapacity) {
        return minimumBlockInstanceCapacity;
    }

    const requiredCapacity = instanceCount + blockInstanceCapacityHeadroom;
    let capacity = minimumBlockInstanceCapacity;

    while (capacity < requiredCapacity) {
        capacity *= 2;
    }

    return capacity;
}
