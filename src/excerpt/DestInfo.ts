import { IDelta } from "../primitive/IDelta";

export interface IDestInfo
{
    rev:number
    offset:number
    length:number // including marker
}

export class DestInfo implements IDestInfo
{
    constructor(public rev:number, public offset:number, public length:number) {

    }
}