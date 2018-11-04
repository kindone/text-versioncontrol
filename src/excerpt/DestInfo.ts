import { IDelta } from "../primitive/IDelta";

export interface IDestInfo
{
    rev:number
    offset:number
    content:IDelta
}

export class DestInfo implements IDestInfo
{
    constructor(public rev:number, public offset:number, public content:IDelta) {

    }
}