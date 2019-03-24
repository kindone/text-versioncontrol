import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op';
import { Source, Change } from './Change';
import { hasNoEffect } from './util';

export class ExDelta extends Delta implements Change {

    constructor(ops:Op[] = [], public source?:Source) {
        super(ops)
    }
}