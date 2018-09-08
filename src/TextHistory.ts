import { Operation } from './Operation'
import { StringWithState } from './StringWithState'

interface ISavepoint
{
    rev: number
    text: string
}

export interface ISyncRequest {
    branchName: string
    baseRev: number
    operations: Operation[]
}

export interface ISyncResponse {
    operations: Operation[]
    revision: number
}

export class TextHistory {
    public static readonly MIN_SAVEPOINT_RATE = 20
    public readonly name: string = ''
    private savepoints: ISavepoint[] = []
    private operations: Operation[] = []

    constructor(name: string, initialText: string = '') {
        this.name = name
        this.doSavepoint(0, initialText)
    }

    public apply(operations: Operation[], name?: string): Operation[] {
        return this.applyAt(this.getCurrentRev(), operations, name)
    }

    public merge(mergeRequest: ISyncRequest): Operation[] {
        return this.applyAt(mergeRequest.baseRev, mergeRequest.operations, mergeRequest.branchName)
    }


    public getCurrentRev(): number {
        return this.operations.length
    }

    public getText(): string {
        return this.getTextForRev(this.getCurrentRev())
    }

    public getTextForRev(rev: number): string {
        const savepoint = this.getNearestSavepointForRev(rev)
        const ss = new StringWithState(savepoint.text)
        for (let i = savepoint.rev; i < rev; i++) ss.apply(this.operations[i], '_')

        return ss.toText()
    }

    private applyAt(baseRev: number, operations: Operation[], name?: string): Operation[] {
        const baseToCurr = this.operations.slice(baseRev)
        const result = this.simulate(name ? name : this.name, baseRev, operations)

        this.operations = this.operations.concat(result.operations)

        if (this.getLatestSavepointRev() + TextHistory.MIN_SAVEPOINT_RATE < this.operations.length) {
            this.doSavepoint(this.operations.length, result.text)

            this.checkSavepoints()
        }

        return baseToCurr
    }

    private simulate(
        name: string,
        baseRev: number,
        operations: Operation[],
    ): { operations: Operation[]; text: string } {
        const baseRevText = this.getTextForRev(baseRev)
        const ss = new StringWithState(baseRevText)
        let newOps: Operation[] = []
        for (let i = baseRev; i < this.operations.length; i++) ss.apply(this.operations[i], this.name)

        for (const op of operations) newOps = newOps.concat(ss.apply(op, name))

        return { operations: newOps, text: ss.toText() }
    }

    private checkSavepoints(): void {
        const initial = this.savepoints[0]
        if (initial.rev !== 0) throw new Error('initial savepoint rev must be 0')

        const ss = new StringWithState(initial.text)
        let j = 0
        for (let rev = 0; rev < this.operations.length; rev++) {
            if (rev > this.getLatestSavepointRev()) break

            if (rev === this.savepoints[j].rev) {
                if (ss.toText() !== this.savepoints[j].text) throw new Error('savepoint is not correct at (' + rev + ',' + j + ')')
                j++
            }
            ss.apply(this.operations[rev], '_')
        }
    }

    private doSavepoint(rev: number, text: string): void {
        this.savepoints.push({ rev, text })
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
