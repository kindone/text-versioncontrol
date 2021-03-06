import { IDelta } from '../../core/IDelta'
import { contentLength } from '../../core/primitive'
import { ChangeList, ChangeListGen } from './ChangeList'
import { ContentGen } from './Content'
import { Generator } from 'jsproptest'

export type ContentChangeList = {
    content: IDelta
    changeList: ChangeList
}


export function ContentChangeListGen(baseLength = -1, numChanges = -1, withEmbed = true, withAttr = true):Generator<ContentChangeList> {
    return ContentGen(baseLength, withEmbed, withAttr).flatMap(content => {
        const initialLength = contentLength(content)
        return ChangeListGen(initialLength, numChanges, withEmbed, withAttr).map(changeList => {
            return { content, changeList }
        })
    })
}
