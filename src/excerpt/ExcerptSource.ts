import Delta = require("quill-delta")
import { IDelta } from "../primitive/IDelta";

export class ExcerptSource
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