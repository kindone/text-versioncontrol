import { Generator, interval, TupleGen } from "jsproptest";
import { Range } from "../../core/Range";

export const RangeGen = (minFrom = 0, maxFrom = 100, minLength = 0, maxLength = 100):Generator<Range> =>
    TupleGen(interval(minFrom, maxFrom), interval(minLength, maxLength)).map((fromAndLength) => new Range(fromAndLength[0], fromAndLength[1]))