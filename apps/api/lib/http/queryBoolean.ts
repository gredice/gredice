import { z } from 'zod';

export const queryBooleanSchema = z
    .enum(['true', 'false'])
    .transform((value) => value === 'true');
