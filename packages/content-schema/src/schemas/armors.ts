import { z } from 'zod';
import { BaseRMObject } from './common';

export const ArmorObject = BaseRMObject.extend({}).passthrough();
export const Armors = z.array(z.nullable(ArmorObject));
