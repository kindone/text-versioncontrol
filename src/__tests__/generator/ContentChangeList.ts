import { Random, Shrinkable } from "fast-check";

import * as _ from 'underscore'
import { IDelta } from "../../primitive/IDelta";
import { contentLength } from "../../primitive/util";
import { ArbitraryWithShrink } from "./util";
import { ChangeList, changeListArbitrary } from "./ChangeList";
import { contentArbitrary } from "./Content";


export interface ContentChangeList {
    content:IDelta,
    changeList:ChangeList
}

export class ContentChangeListArbitrary extends ArbitraryWithShrink<ContentChangeList> {

    constructor(readonly baseLength = -1, readonly numChanges:number = -1, readonly withAttr = false) {
        super()
    }

    public generate(mrng:Random):Shrinkable<ContentChangeList> {
        const value = this.gen(mrng)
        return this.wrapper(value)
    }

    private gen(mrng:Random):ContentChangeList {
       const content = contentArbitrary(this.baseLength, true/*withEmbed*/, this.withAttr).generate(mrng).value
       const initialLength = contentLength(content)
       const changeList = changeListArbitrary(initialLength, this.numChanges).generate(mrng).value
       return {content, changeList}
    }

    public *shrinkGen(value:ContentChangeList):IterableIterator<Shrinkable<ContentChangeList>> {
        // TODO
    }
}

export const contentChangeListArbitrary = (baseLength = -1, numChanges:number = -1) => new ContentChangeListArbitrary(baseLength, numChanges)

