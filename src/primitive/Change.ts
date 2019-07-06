import Op from 'quill-delta/dist/Op'
import {ChangeContext} from './ChangeContext'

export interface Change {
    ops: Op[]
    contexts?: ChangeContext[]
}
