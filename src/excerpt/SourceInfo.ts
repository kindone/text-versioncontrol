import { IDelta } from "../primitive/IDelta";

export interface ISourceInfo
{
    uri:string
    rev:number
    offset:number
    retain:number
    length:number
    content:IDelta
}

export class SourceInfo
{
    constructor(
        public uri: string,
        public rev:number,
        public offset:number,
        public retain:number,
        public length: number,
        public content:IDelta)
    {
    }
}