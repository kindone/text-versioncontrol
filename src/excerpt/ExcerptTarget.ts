import { IDelta } from "../primitive/IDelta";

export class ExcerptTarget
{
    constructor(
        public rev:number,
        public offset:number,
        public length:number) {

    }
}