import { z } from 'zod';
import { BaseRMObject } from './common';

export const SkillObject = BaseRMObject.extend({}).passthrough();
export const Skills = z.array(z.nullable(SkillObject));
