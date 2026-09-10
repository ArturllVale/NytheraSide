import { z } from 'zod';
import { BaseRMObject } from './common';

export const EnemyObject = BaseRMObject.extend({}).passthrough();
export const Enemies = z.array(z.nullable(EnemyObject));
