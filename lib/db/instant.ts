import { init } from '@instantdb/react';
import { schema } from './schema';

const APP_ID = 'c470e575-d873-4a58-830b-8830949f9597';

export const db = init({ appId: APP_ID, schema });
