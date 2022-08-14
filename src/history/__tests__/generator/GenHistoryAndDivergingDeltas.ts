import { GenHistory } from "./GenHistory"
import { deltaLength } from "../../../core/primitive"
import { ContentChangeListGen } from "../../../__tests__/generator/ContentChangeList"
import { ChangeListGen } from "../../../__tests__/generator/ChangeList"
import { just, TupleGen } from "jsproptest"

export const GenHistoryAndDivergingChanges = (initialLength = 4, maxChanges = 20) => GenHistory(initialLength, maxChanges).flatMap((history) => {
    const content = history.getContent()
    const length = deltaLength(content)
    const genChanges = ChangeListGen(length)
    return TupleGen(just(history), genChanges, genChanges)
})