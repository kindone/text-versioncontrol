import { Source } from '../primitive/Change';
import { ExcerptTarget } from './ExcerptTarget'


export class Excerpt {
    constructor(public source: Source, public target: ExcerptTarget) {}
}
