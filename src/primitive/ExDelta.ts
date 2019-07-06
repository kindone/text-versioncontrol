import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op';
import { DeltaContext } from './DeltaContext';
import { IDelta } from './IDelta';

export class ExDelta extends Delta implements IDelta {
    constructor(ops:Op[] = [], public contexts?:DeltaContext[]) {
        super(ops)
    }
}