import { z } from 'zod';

// Example DTO schema for a garden (adjust as needed)
export const gardenDtoSchema = z.object({
    id: z.number(),
    name: z.string(),
    createdAt: z.string(),
    // Add other fields as needed
});

// Example DTO validation test
import { test, expect } from '@playwright/test';

test('validates garden DTO shape', () => {
    const valid = gardenDtoSchema.safeParse({
        id: 1,
        name: 'Test Garden',
        createdAt: new Date().toISOString(),
    });
    expect(valid.success).toBe(true);

    const invalid = gardenDtoSchema.safeParse({
        id: 'not-a-number',
        name: 123,
        createdAt: 123,
    });
    expect(invalid.success).toBe(false);
});
