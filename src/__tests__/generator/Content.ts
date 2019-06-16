import fc, { Random, Shrinkable } from 'fast-check';
import { emptyOpsArbitrary } from './op';

import Delta = require('quill-delta');
import * as _ from 'underscore'
import { opsArbitrary, OpsArbitrary } from './Ops';
import { ArbitraryWithShrink } from './util';
import { insertArbitrary, InsertArbitrary, Insert } from './Insert';
import Op from 'quill-delta/dist/Op';
import { Change } from '../../primitive/Change';



export const contentArbitrary = (withAttr = false):fc.Arbitrary<Change> => fc.array(new InsertArbitrary(1, 20, false, false),10).map(ops => ({ops}))

