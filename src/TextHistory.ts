import Delta = require('quill-delta')
import { StringWithState } from './StringWithState'

interface ISavepoint
{
    rev: number
    content: Delta
}

export interface ISyncRequest {
    branchName: string
    baseRev: number
    deltas: Delta[]
}

export interface ISyncResponse {
    deltas: Delta[]
    revision: number
}

export class TextHistory {
    public static readonly MIN_SAVEPOINT_RATE = 20
    public readonly name: string = ''
    private savepoints: ISavepoint[] = []
    private deltas: Delta[] = []

    constructor(name: string, initialText: string = '') {
        this.name = name
        this.doSavepoint(0, new Delta([{insert: initialText}]))
    }

    public apply(deltas: Delta[], name?: string): Delta[] {
        return this.applyAt(this.getCurrentRev(), deltas, name)
    }

    public merge(mergeRequest: ISyncRequest): Delta[] {
        return this.applyAt(mergeRequest.baseRev, mergeRequest.deltas, mergeRequest.branchName)
    }


    public getCurrentRev(): number {
        return this.deltas.length
    }

    public getText(): string {
        return this.getTextForRev(this.getCurrentRev())
    }

    public getTextForRev(rev: number): string {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = StringWithState.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++) ss.apply(this.deltas[i], '_')

        return ss.toText()
    }

    public getContent(): Delta {
        return this.getContentForRev(this.getCurrentRev())
    }

    public getContentForRev(rev: number): Delta {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = StringWithState.fromDelta(savepoint.content)
        for (let i = savepoint.rev; i < rev; i++) ss.apply(this.deltas[i], '_')

        return ss.toDelta()
    }

    private applyAt(baseRev: number, deltas: Delta[], name?: string): Delta[] {
        const baseToCurr = this.deltas.slice(baseRev)
        const result = this.simulate(name ? name : this.name, baseRev, deltas)

        this.deltas = this.deltas.concat(result.deltas)

        if (this.getLatestSavepointRev() + TextHistory.MIN_SAVEPOINT_RATE < this.deltas.length) {
            this.doSavepoint(this.deltas.length, result.content)

            this.checkSavepoints()
        }

        return baseToCurr
    }

    private simulate(
        name: string,
        baseRev: number,
        deltas: Delta[],
    ): { deltas: Delta[]; content: Delta } {
        const baseRevText = this.getContentForRev(baseRev)
        const ss = StringWithState.fromDelta(baseRevText)
        let newDeltas: Delta[] = []
        for (let i = baseRev; i < this.deltas.length; i++) ss.apply(this.deltas[i], this.name)

        for (const op of deltas) newDeltas = newDeltas.concat(ss.apply(op, name))

        return { deltas: newDeltas, content: ss.toDelta() }
    }

    private checkSavepoints(): void {
        const initial = this.savepoints[0]
        if (initial.rev !== 0) throw new Error('initial savepoint rev must be 0')

        const ss = StringWithState.fromDelta(initial.content)
        let j = 0
        for (let rev = 0; rev < this.deltas.length; rev++) {
            if (rev > this.getLatestSavepointRev()) break

            if (rev === this.savepoints[j].rev) {
                if (JSON.stringify(ss.toDelta()) !== JSON.stringify(this.savepoints[j].content))
                {
                    throw new Error('savepoint is not correct at (' + rev + ',' + j + '):'  + JSON.stringify(ss.toDelta()) + " and " + JSON.stringify(this.savepoints[j].content))
                }
                j++
            }
            ss.apply(this.deltas[rev], '_')
        }
    }

    private doSavepoint(rev: number, content: Delta): void {
        this.savepoints.push({ rev, content })
    }

    private getLatestSavepointRev(): number {
        return this.savepoints[this.savepoints.length - 1].rev
    }

    private getNearestSavepointForRev(rev: number): ISavepoint {
        let nearestSavepoint = this.savepoints[0]
        for (const savepoint of this.savepoints) {
            if (rev <= savepoint.rev) break
            nearestSavepoint = savepoint
        }

        return nearestSavepoint
    }
}
