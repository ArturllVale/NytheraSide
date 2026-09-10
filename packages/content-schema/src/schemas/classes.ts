import { z } from 'zod';
import { BaseRMObject } from './common';

export const ClassObject = BaseRMObject.extend({}).passthrough();
export const Classes = z.array(z.nullable(ClassObject));
