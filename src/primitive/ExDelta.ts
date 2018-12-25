import QuillDelta = require('quill-delta')
import Op from 'quill-delta/dist/Op';
import { Source } from './IDelta';
import { isDeltaWithNoEffect } from './util';

export class ExDelta extends QuillDelta {

    constructor(ops:Op[] = [], public source?:Source) {
        super(ops)
    }
}