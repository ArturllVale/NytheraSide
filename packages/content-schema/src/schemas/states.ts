import { z } from 'zod';
import { BaseRMObject } from './common';

export const StateObject = BaseRMObject.extend({}).passthrough();
export const States = z.array(z.nullable(StateObject));
