import * as _ from 'underscore'
import { CharWithState } from "./CharWithState";

export interface IChars {

    readonly length:number

    isVisibleTo(idx:number, branch:string):boolean

    shouldAdvanceForTiebreak(idx:number, branch:string):boolean

    isVisible(idx:number):boolean

    setDeletedBy(idx:number, branch:string):void

    isDeleted(idx:number):boolean

    slice(start:number, end?:number):IChars

    concat(other:IChars):IChars

    visiblePosOf(pos:number):number

    clone():IChars

    equals(cs:IChars):boolean

    toHtml():string

    toText():string
}


export class CharsWithState implements IChars{
    public static fromString(str:string) {
        const chars:CharWithState[] = []
        for (let i = 0; i < str.length; i++) chars.push(new CharWithState(str.charAt(i)))

        return new CharsWithState(chars)
    }

    private chars:CharWithState[]

    constructor(chars:CharWithState[]) {
        this.chars = chars
    }

    public get length():number {
        return this.chars.length
    }

    public isVisibleTo(idx:number, branch:string) {
        return this.chars[idx].isVisibleTo(branch)
    }

    public shouldAdvanceForTiebreak(idx:number, branch:string) {
        return this.chars[idx].shouldAdvanceForTiebreak(branch)
    }

    public isVisible(idx:number) {
        return this.chars[idx].isVisible()
    }

    public setDeletedBy(idx:number, branch:string) {
        this.chars[idx].setDeletedBy(branch)
    }

    public isDeleted(idx:number) {
        return this.chars[idx].isDeleted()
    }

    public slice(start:number, end?:number) {
        return new CharsWithState(this.chars.slice(start, end))
    }

    public concat(other:CharsWithState) {
        return new CharsWithState(this.chars.concat(other.chars))
    }

    public visiblePosOf(pos:number) {
        return _.reduce(
            this.chars.slice(0, pos),
            (sum, char) => {
                return char.isVisible() ? sum + 1 : sum
            },
            0,
        )
    }

    public clone()
    {
        const ss = new CharsWithState([])
        for (const cs of this.chars) {
            const char = new CharWithState(cs.val, cs.mod.insertedBy ? cs.mod.insertedBy.concat() : undefined, new Set(cs.mod.deletedBy))
            ss.chars.push(char)
        }
        return ss
    }

    public equals(cs:CharsWithState)
    {
        if (this.chars.length !== cs.chars.length) return false
        for (let i = 0; i < this.chars.length; i++) {
            if (!cs.chars[i].equals(this.chars[i])) return false
        }
        return true
    }

    public toHtml() {
        let html = ''
        let prevclassesstr = ''
        for (const cs of this.chars) {
            const classes: string[] = []
            const branches = cs.mod.deletedBy
            if (cs.isDeleted()) {
                classes.push('deleted')
            }
            if (cs.mod.insertedBy) {
                classes.push('inserted')
                branches.add(cs.mod.insertedBy)
            }
            Object.keys(branches).forEach(branch => {
                classes.push(`b${branch}`)
            })

            if (classes.length > 0) {
                const classesstr = classes.join(' ')
                if (classesstr === prevclassesstr) {
                    html += cs.val
                } else {
                    if (prevclassesstr !== '') html += '</span>'
                    html += `<span class='${classesstr}'>${cs.val}`
                }

                prevclassesstr = classesstr
            } else {
                if (prevclassesstr !== '') html += '</span>'
                html += cs.val
                prevclassesstr = ''
            }
        }

        if (prevclassesstr !== '') html += '</span>'

        return html
    }

    public toText() {
        let text = ''
        for (const char of this.chars) {
            if (!char.isDeleted()) text += char.val
        }
        return text
    }
}