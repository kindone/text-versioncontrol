import { ExcerptSource } from './ExcerptSource'
import { ExcerptTarget } from './ExcerptTarget'

export interface IExcerpt {
    sourceUri:string
    sourceRev:number
    targetUri:string
    targetRev:number
    length:number
}


export class Excerpt {
    constructor(public source: ExcerptSource, public target: ExcerptTarget) {}
}
