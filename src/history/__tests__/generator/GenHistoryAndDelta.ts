import { interval, TupleGen } from "jsproptest"
import { History } from "../../History"
import { IDelta } from "../../../core/IDelta"
import { ContentChangeList, ContentChangeListGen } from "../../../__tests__/generator/ContentChangeList"

// make sure changing savepoint rate is safe
const minSavepointRateGen = interval(1,5)
// make sure changing initial rev is safe
const initialRevGen = interval(0, 20)
// content and change list of various lengths (list length at least 1)
const contentChangeListGen = (initialLength:number, maxChanges:number) => interval(1, maxChanges+1).flatMap(listLength => ContentChangeListGen(initialLength, listLength, true))

export function GenHistoryAndDelta(initialLength:number = 4, maxChanges:number = 20) {
    return TupleGen(minSavepointRateGen, initialRevGen, contentChangeListGen(initialLength, maxChanges)).map((triple:[number, number, ContentChangeList]) => {
        const [minSavepointRate, initialRev, contentAndChanges] = triple
        const deltas = contentAndChanges.changeList.deltas
        const initialDeltas = deltas.slice(0, deltas.length-1)
        const lastDelta = deltas[deltas.length-1]
        const history = History.create("_", contentAndChanges.content, initialDeltas, initialRev, minSavepointRate)
        const result:[History, IDelta] = [history,lastDelta]
        return result
    })
}