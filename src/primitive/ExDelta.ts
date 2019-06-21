import Delta = require('quill-delta')
import Op from 'quill-delta/dist/Op';
import { Change } from './Change';

export class ExDelta extends Delta implements Change {
    constructor(ops:Op[] = [], public source?:Array<{uri:string, rev: number}>) {
        super(ops)
    }
}