import { Operation } from './Operation'
import { StringWithState } from './StringWithState'

type Savepoint = { rev: number; text: string }
export type MergeRequest = {
    branchName: string
    baseRev: number
    operations: Operation[]
}

export type SyncResponse = {
    operations: Operation[]
    revision: number
}

export class TextHistory {
    static MIN_SAVEPOINT_RATE = 20

    savepoints: Savepoint[] = []
    operations: Operation[] = []
    name: string = ''

    constructor(name: string, initialText: string = '') {
        this.name = name
        this.doSavepoint(0, initialText)
    }

    apply(operations: Operation[], name?: string): Operation[] {
        return this.applyAt(this.getCurrentRev(), operations, name)
    }

    merge(mergeRequest: MergeRequest): Operation[] {
        return this.applyAt(mergeRequest.baseRev, mergeRequest.operations, mergeRequest.branchName)
    }

    private applyAt(baseRev: number, operations: Operation[], name?: string): Operation[] {
        const base_to_curr = this.operations.slice(baseRev)
        const result = this.simulate(name ? name : this.name, baseRev, operations)
        // console.debug('result', result)

        this.operations = this.operations.concat(result.operations)

        if (this.getLatestSavepointRev() + TextHistory.MIN_SAVEPOINT_RATE < this.operations.length) {
            this.doSavepoint(this.operations.length, result.text)
            // console.debug('savepointed at rev: ' + this.operations.length)
            this.checkSavepoints()
        }

        return base_to_curr
    }

    private simulate(
        name: string,
        baseRev: number,
        operations: Operation[],
    ): { operations: Operation[]; text: string } {
        let baseRevText = this.getTextForRev(baseRev)
        let ss = new StringWithState(baseRevText)
        let new_ops: Operation[] = []
        for (let i = baseRev; i < this.operations.length; i++) ss.apply(this.operations[i], this.name)

        for (let i = 0; i < operations.length; i++) new_ops = new_ops.concat(ss.apply(operations[i], name))

        return { operations: new_ops, text: ss.toText() }
    }

    private checkSavepoints(): void {
        const initial = this.savepoints[0]
        if (initial.rev != 0) throw 'initial savepoint rev must be 0'

        const ss = new StringWithState(initial.text)
        let j = 0
        for (let rev = 0; rev < this.operations.length; rev++) {
            if (rev > this.getLatestSavepointRev()) break

            if (rev == this.savepoints[j].rev) {
                if (ss.toText() != this.savepoints[j].text) throw 'savepoint is not correct at (' + rev + ',' + j + ')'
                j++
            }
            ss.apply(this.operations[rev], '_')
        }
    }

    private doSavepoint(rev: number, text: string): void {
        this.savepoints.push({ rev, text })
    }

    getCurrentRev(): number {
        return this.operations.length
    }

    private getLatestSavepointRev(): number {
        return this.savepoints[this.savepoints.length - 1].rev
    }

    private getNearestSavepointForRev(rev: number): Savepoint {
        let nearest_savepoint = this.savepoints[0]
        for (let i = 0; i < this.savepoints.length; i++) {
            const savepoint = this.savepoints[i]
            if (rev <= savepoint.rev) break
            nearest_savepoint = savepoint
        }
        // if(nearest_savepoint != this.savepoints[0])
        //     console.debug('using non-zero rev savepoint rev: ' + nearest_savepoint.rev)
        return nearest_savepoint
    }

    getText(): string {
        return this.getTextForRev(this.getCurrentRev())
    }

    getTextForRev(rev: number): string {
        let savepoint = this.getNearestSavepointForRev(rev)
        let ss = new StringWithState(savepoint.text)
        for (let i = savepoint.rev; i < rev; i++) ss.apply(this.operations[i], '_')

        return ss.toText()
    }
}
