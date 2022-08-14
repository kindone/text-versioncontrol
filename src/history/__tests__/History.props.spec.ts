import { interval, Property } from "jsproptest"
import { IDelta } from "../../core/IDelta"
import { normalizeDeltas } from "../../core/primitive"
import { expectEqual } from "../../core/util"
import { ContentChangeList, ContentChangeListGen } from "../../__tests__/generator/ContentChangeList"
import { ChangeList } from "../../__tests__/generator/ChangeList"
import { History } from "../History"
import { GenHistoryAndDelta} from "./generator/GenHistoryAndDelta"
import { GenHistoryAndDivergingChanges } from "./generator/GenHistoryAndDivergingDeltas"

describe('History', () => {
    const minSavepointRateGen = interval(1,5)
    const initialRevGen = interval(0, 20)
    // content and change list of various lengths (list length at least 1)
    const contentChangeListGen = interval(1, 20).flatMap(listLength => ContentChangeListGen(4, listLength, true))

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

    const historyAndDeltaGen = GenHistoryAndDelta()

    it('History::append single', () => {
        const prop = new Property((historyAndDelta:[History, IDelta]) => {
            const [history, delta] = historyAndDelta

            const rev = history.getCurrentRev()
            history.append([delta])

            expectEqual(rev+1, history.getCurrentRev())
            expectEqual(normalizeDeltas(delta), normalizeDeltas(history.getChangeFor(rev+1)))
            expectEqual(history.getChangeAt(rev), history.getChangeFor(rev+1))
        })
        prop.setNumRuns(100).forAll(historyAndDeltaGen)
    })

    it('History::merge single', () => {
        const prop = new Property((historyAndDelta:[History, IDelta]) => {
            const [history, delta] = historyAndDelta

            const rev = history.getCurrentRev()
            const mergeReq = {branch: "_", rev: rev, changes: [delta]}

            // single merge behaves the same as single append
            history.merge(mergeReq)

            expectEqual(rev+1, history.getCurrentRev())
            expectEqual(normalizeDeltas(delta), normalizeDeltas(history.getChangeFor(rev+1)))
            expectEqual(history.getChangeAt(rev), history.getChangeFor(rev+1))
        })
        prop.setNumRuns(100).forAll(historyAndDeltaGen)
    })

    const historyAndDivergingChanges = GenHistoryAndDivergingChanges()

    it('History::merge arbitrary', () => {
        const prop = new Property((historyAndDivergingChanges:[History, ChangeList, ChangeList]) => {
            const [history, changes1, changes2] = historyAndDivergingChanges
            const initialRev = history.getCurrentRev()

            // append change1
            history.append(changes1.deltas)
            const rev1 = history.getCurrentRev()
            expectEqual(rev1, initialRev+changes1.deltas.length)

            // merge change2
            const mergeReq = {branch: "_", rev: initialRev, changes: changes2.deltas}
            history.merge(mergeReq)

            const rev2 = history.getCurrentRev()

            // revision is increased
            expectEqual(rev2, rev1+changes2.deltas.length)
            // merge must not alter existing changes
            expectEqual(normalizeDeltas(...history.getChangesInRange(initialRev, rev1)), normalizeDeltas(...changes1.deltas))
        })
        prop.setNumRuns(100).forAll(historyAndDivergingChanges)
    })

    it('History::rebase arbitrary', () => {
        const prop = new Property((historyAndDivergingChanges:[History, ChangeList, ChangeList]) => {
            const [history, changes1, changes2] = historyAndDivergingChanges
            const initialRev = history.getCurrentRev()

            // append change1
            history.append(changes1.deltas)
            const rev1 = history.getCurrentRev()
            expectEqual(rev1, initialRev+changes1.deltas.length)

            // merge change2
            const mergeReq = {branch: "_", rev: initialRev, changes: changes2.deltas}
            history.rebase(mergeReq)

            const rev2 = history.getCurrentRev()

            expectEqual(rev2, rev1+changes2.deltas.length)
            // rebase inserts changes2 to initialRev and shifts changes beyond it
            expectEqual(normalizeDeltas(...history.getChangesInRange(initialRev, initialRev + changes2.deltas.length)), normalizeDeltas(...changes2.deltas))
        })
        prop.setNumRuns(100).forAll(historyAndDivergingChanges)
    })

})