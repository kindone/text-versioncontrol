import { interval, TupleGen } from "jsproptest"
import { History } from "../../History"
import { ContentChangeList, ContentChangeListGen } from "../../../__tests__/generator/ContentChangeList"

// make sure changing savepoint rate is safe
const minSavepointRateGen = interval(1,5)
// make sure changing initial rev is safe
const initialRevGen = interval(0, 20)
// content and change list of various lengths (list length at least 1)
const contentChangeListGen = (initialLength:number, maxChanges:number) => interval(0, maxChanges).flatMap(listLength => ContentChangeListGen(initialLength, listLength, true))

export function GenHistory(initialLength:number = 4, maxChanges:number = 20) {
    return TupleGen(minSavepointRateGen, initialRevGen, contentChangeListGen(initialLength, maxChanges)).map((triple:[number, number, ContentChangeList]) => {
        const [minSavepointRate, initialRev, contentAndChanges] = triple
        const deltas = contentAndChanges.changeList.deltas
        return History.create("_", contentAndChanges.content, deltas, initialRev, minSavepointRate)
    })
}