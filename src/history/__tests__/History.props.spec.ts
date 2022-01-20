import { interval, Property } from "jsproptest"
import { normalizeDeltas } from "../../core/primitive"
import { expectEqual, JSONStringify } from "../../core/util"
import { ContentChangeList, ContentChangeListGen } from "../../__tests__/generator/ContentChangeList"
import { History } from "../History"

describe('History', () => {
    // make sure changing savepoint rate is safe
    const minSavepointRateGen = interval(1,5)
    // make sure changing initial rev is safe
    const initialRevGen = interval(0, 20)
    // content and change list of various lengths
    const contentChangeListGen = interval(0, 20).flatMap(listLength => ContentChangeListGen(4, listLength, true))

    it('History::create/getObject pair', () => {
        const prop = new Property((minSavepointRate:number, initialRev:number, contentAndChanges:ContentChangeList) => {
            const history1 = History.create("_", contentAndChanges.content, contentAndChanges.changeList.deltas, initialRev, minSavepointRate)
            const obj1 = history1.getObject()
            const history2 = History.create(obj1.name, obj1.savepoints[0].content, obj1.changes, obj1.initialRev, obj1.minSavepointRate)
            const obj2 = history2.getObject()
            expectEqual(obj1, obj2)
        })
        prop.setNumRuns(1000).forAll(minSavepointRateGen, initialRevGen, contentChangeListGen)
    })

    it('History::append single', () => {
        const prop = new Property((minSavepointRate:number, initialRev:number, contentAndChanges:ContentChangeList) => {
            // apply all changes except last one
            const deltas = contentAndChanges.changeList.deltas
            const initialDeltas = deltas.slice(0, deltas.length-1)
            const lastDelta = deltas[deltas.length-1]
            const history = History.create("_", contentAndChanges.content, initialDeltas, initialRev, minSavepointRate)
            if(contentAndChanges.changeList.deltas.length < 1)
                return

            const rev = history.getCurrentRev()

            history.append([lastDelta])

            expectEqual(rev+1, history.getCurrentRev())
            expectEqual(normalizeDeltas(lastDelta), normalizeDeltas(history.getChangeFor(rev+1)))
            expectEqual(history.getChangeAt(rev), history.getChangeFor(rev+1))
        })
        prop.setNumRuns(1000).forAll(minSavepointRateGen, initialRevGen, contentChangeListGen)
    })

})