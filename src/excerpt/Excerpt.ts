import { Source } from '../core/Source';
import { ExcerptTarget } from './ExcerptTarget'


export class Excerpt {
    constructor(public source: Source, public target: ExcerptTarget) {}
}
