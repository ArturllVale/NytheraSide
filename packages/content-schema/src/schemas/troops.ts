import { z } from 'zod';
import { BaseRMObject } from './common';

export const TroopObject = BaseRMObject.extend({}).passthrough();
export const Troops = z.array(z.nullable(TroopObject));
