import Delta = require("quill-delta")
import { IDelta } from "../primitive/IDelta";


export interface ISourceInfo
{
    uri:string
    rev:number
    offset:number
    retain:number
    content:IDelta
}

export class SourceInfo implements ISourceInfo
{
    constructor(
        public uri: string,
        public rev:number,
        public offset:number,
        public retain:number,
        public content:IDelta)
    {
    }
}