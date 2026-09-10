import { z } from 'zod';
import { BaseRMObject } from './common';

export const WeaponObject = BaseRMObject.extend({}).passthrough();
export const Weapons = z.array(z.nullable(WeaponObject));
