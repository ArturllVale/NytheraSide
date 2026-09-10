import { z } from 'zod';
import { BaseRMObject } from './common';

// We extend BaseRMObject and allow extra fields to be passed through.
export const ActorObject = BaseRMObject.extend({}).passthrough();

// The array can have null at index 0 and then ActorObject or null.
export const Actors = z.array(z.nullable(ActorObject));
