import { z } from 'zod';
import { BaseRMObject } from './common';

export const ItemObject = BaseRMObject.extend({}).passthrough();
export const Items = z.array(z.nullable(ItemObject));
