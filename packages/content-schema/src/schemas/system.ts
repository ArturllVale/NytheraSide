import { z } from 'zod';

// System.json is a single object with various settings.
// We'll allow any keys and values, but we want to ensure it's an object.
// We'll use z.object({}).catchall(z.unknown()) to allow any keys and then we'll just keep the object as is.
// We'll not make it strict because we don't know all the keys.
export const System = z.object({}).catchall(z.unknown());
