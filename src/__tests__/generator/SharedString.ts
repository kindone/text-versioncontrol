import { PrintableASCIIStringGen } from 'jsproptest'
import { SharedString } from '../../core/SharedString'

export function SharedStringGen() {
    return PrintableASCIIStringGen(0, 10).map(str => SharedString.fromString(str))
}
