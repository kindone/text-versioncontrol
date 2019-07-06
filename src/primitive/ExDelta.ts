import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op';
import { Change } from './Change';
import { ChangeContext } from './ChangeContext';

export class ExDelta extends Delta implements Change {
    constructor(ops:Op[] = [], public contexts?:ChangeContext[]) {
        super(ops)
    }
}