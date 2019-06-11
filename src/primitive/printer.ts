import * as chalk from 'chalk'
import { Change } from "./Change"
import { SharedString } from './SharedString';
import { JSONStringify } from './util';

const excerptSource = chalk.default.cyan
const excerptTarget = chalk.default.red

const initial = (text:string) => text // black
const initialObj = chalk.default.whiteBright
const insert = chalk.default.green
const insertObj = chalk.default.greenBright
const fill = (char:string, size:number) => {
    let str = ''
    for(let i = 0; i < size; i++)
        str += char
    return str
}
const retain = (size:number) => chalk.default.underline.gray(fill('?', size))
const retainAttr = (size:number) => chalk.default.underline.yellow(fill('?', size))
const del = (size:number) => chalk.default.strikethrough.redBright(fill('X', size))
const delContent = (text:string) => {
    text = text.replace(/ /g, '_')
    return chalk.default.strikethrough.redBright(text)
}
const meta = chalk.default.magentaBright

export function printContent(delta:Change):string {
    let str = ''
    for(const op of delta.ops)
    {
        if(typeof op.insert === 'string') {
            str += initial(op.insert)
        }
        else if(op.insert) {
            str += initialObj(JSON.stringify(op.insert) + (op.attributes ? ":" + JSONStringify(op.attributes) : ""))
        }
        else if(op.retain && op.attributes) {
            str += retainAttr(op.retain)
        }
        else if(op.retain)  {
            str += retain(op.retain)
        }
        else if(op.delete) {
            str += del(op.delete)
        }
    }
    return str
}

export function printChange(delta:Change):string {
    let str = ''
    for(const op of delta.ops)
    {
        if(typeof op.insert === 'string') {
            str += insert(op.insert)
        }
        else if(op.insert) {
            str += insertObj(JSON.stringify(op.insert))
        }
        else if(op.retain && op.attributes) {
            str += retainAttr(op.retain)
        }
        else if(op.retain)  {
            str += retain(op.retain)
        }
        else if(op.delete) {
            str += del(op.delete)
        }
    }
    return str
}

export function printChanges(changes:Change[]) {
    let str = meta('[ ')
    for(const change of changes) {
        str += printChange(change)
        str += meta(', ')
    }
    str += meta(' ]')
    return str
}

export function printChangedContent(content:Change, changes:Change[]):string {
    let ss = SharedString.fromDelta(content)
    let str = meta('[ ')
    for(const change of changes)
    {
        ss.applyChange(change, '_')

        const styledJSON = ss.toStyledJSON()

        for(const obj of styledJSON)
        {
            if(obj.type === 'initial') {
                if(typeof obj.value === 'string') {
                    str += initial(obj.value)
                }
                else if(obj.value.type === 'embed') {
                    str += initialObj(JSONStringify(obj.value.value))
                }
            }
            else if(obj.type === 'inserted') {
                if(typeof obj.value === 'string') {
                    str += insert(obj.value)
                }
                else if(obj.value.type === 'embed') {
                    str += insertObj(JSONStringify(obj.value.value))
                }
            }
            else if(obj.type === 'deleted') {
                if(typeof obj.value === 'string') {
                    str += delContent(obj.value)
                }
                else if(obj.value.type === 'embed') {
                    str += delContent(JSONStringify(obj.value.value))
                }
            }
        }
        // str += meta(' (') + JSONStringify(ss) + meta(')')
        str += meta(', ')

        ss = SharedString.fromDelta(ss.toDelta())
    }

    str += meta(' ]')


    return str
}