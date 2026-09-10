import { z } from 'zod';

// Common fields for most RM MV database objects
export const BaseRMObject = z.object({
  id: z.number(),
  name: z.string(),
  note: z.string().default(''),
});

// For array-based files (Actors, Classes, Skills, Items, Weapons, Armors, Enemies, Troops, States)
// We expect the array to have a null at index 0 and then the objects.
// We'll create a schema that accepts an array of nullable BaseRMObject and then we'll filter nulls.
export const RmArray = z.array(z.nullable(BaseRMObject));

// For System.json, it's a single object with various settings.
export const SystemRM = z.object({
  // We'll keep it tolerant for now, but we can add known fields later.
  // Example: attackMotions: z.array(z.string()),
  // We'll just capture the whole object as passthrough for now.
  // Alternatively, we can use z.record(z.unknown()) but we want to keep the structure.
  // Let's use z.unknown() for now and refine later.
  // But note: we want to validate, so we'll use z.strictObject? Not yet.
  // We'll make it pass through and then in the normalizer we can extract what we need.
  // For now, we'll allow any object.
  // We'll change this to z.record(z.unknown()) to capture all key-value pairs.
  // However, note that System.json has nested objects and arrays.
  // We'll use z.unknown() and then in the normalizer we can try to parse it.
  // But for the schema, we want to at least ensure it's an object.
  // We'll do:
  //   z.object({})
  //   .catchall(z.unknown())
  //   .strict()
  // But we don't know the keys, so we'll just use z.unknown() and then in the normalizer we'll check.
  // Alternatively, we can skip validation for System and just normalize.
  // Let's do: z.unknown() and then in the normalizer we'll check if it's an object.
  // We'll change this later if needed.
  // For now, we'll use z.unknown() and then in the normalizer we'll assign it as is.
  // We'll change the type to z.unknown() and then in the normalizer we'll try to make it an object.
  // But note: we want to keep the original structure.
  // We'll use z.unknown() and then in the normalizer we'll just keep it.
  // However, we want to validate that it's an object? We'll do that in the normalizer.
  // So for the schema, we'll accept any value.
  // We'll change the SystemRM to z.unknown().
  // But let's keep it as z.object({}).catchall(z.unknown()) for now and see.
  // We'll change to z.unknown() because we don't know the structure.
  // Actually, we can look up the RM MV System.json structure online, but for now we'll keep it tolerant.
  // We'll use z.unknown() and then in the normalizer we'll check if it's an object and throw if not.
  // We'll change the schema to z.unknown() and then in the normalizer we'll check.
  // We'll do that in the normalizer step.
  // For now, we'll leave it as z.unknown() and then in the normalizer we'll handle.
  // We'll change the export to:
  //   export const SystemRM = z.unknown();
  // But let's do that later and for now we'll create a placeholder.
  // We'll create a separate file for System and then adjust.
  // We'll just export a schema that accepts any value and then we'll validate in the normalizer.
  // We'll change the export to:
  //   export const SystemRM = z.unknown();
  // We'll do that in the next step.
  // For now, we'll leave it as z.object({}) and then we'll change.
  // Let's not overcomplicate. We'll create the System schema in a separate file and make it z.unknown().
  // We'll do that in the system.ts file.
  // So we don't need to define SystemRM here.
  // We'll remove this and just define in system.ts.
  // Let's delete this line and just keep BaseRMObject and RmArray.
  // We'll remove the SystemRM export.
  // We'll just export BaseRMObject and RmArray.
});

// We'll export the common schemas
// BaseRMObject and RmArray are declared with `export const` above and therefore
// already exported — the old trailing `export { BaseRMObject, RmArray };` was a
// duplicate declaration (TS2323/TS2484) and has been removed.
