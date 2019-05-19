import { Source } from '../primitive/Source';
import { ExcerptTarget } from './ExcerptTarget'


export class Excerpt {
    constructor(public source: Source, public target: ExcerptTarget) {}
}
