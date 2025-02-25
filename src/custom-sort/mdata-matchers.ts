import {
    getNormalizedDate_NormalizerFn_for
} from "./matchers";
import {NormalizerFn} from "./custom-sort-types";
import {CollatorCompare, CollatorTrueAlphabeticalCompare} from "./custom-sort";

export interface MDataMatcher {
    (mdataValue: string): boolean
}

export type SN = string|number
export type SNResult<T extends SN> = T extends number ? number : string
export type CompareFn<T extends SN> = (a: T, b: T) => number
export interface MDataMatcherFactory<T extends SN> {
    (specsMatch: string|RegExpMatchArray, compareFn: CompareFn<SNResult<T>>, mdvConverter: MDVConverter<SNResult<T>>): MDataMatcher
}

interface ValueMatcherSpec<T extends SN> {
    specPattern: string|RegExp,
    valueMatcherFnFactory: MDataMatcherFactory<SNResult<T>>
    compareFn: CompareFn<SNResult<T>>
    mdvConterter?: MDVConverter<SNResult<T>>
    unitTestsId: string
}

export interface MDataMatcherParseResult {
    m: MDataMatcher
    remainder: string
}

const VALUE_MATCHER_REGEX = /value\(([^)]+)\)/  // 001 === 1
const VALUE_TRUE_ALPHABETIC_MATCHER_REGEX = /valueE\(([^)]+)\)/  // 001 != 1
function getPlainValueMatcherFn(specsMatch: RegExpMatchArray, compareFn: CompareFn<string>) {
    const EXACT_VALUE_IDX = 1 // Related to the spec regexp
    const expectedValue = specsMatch[EXACT_VALUE_IDX].trim()
    return (mdataValue: string): boolean => {
        return compareFn(mdataValue, expectedValue) === 0
    }
}

const RANGE_MATCHER_REGEX = /range([[(])([^,]*),([^)\]]*)([)\]])/
const RANGE_TRUE_ALPHABETIC_MATCHER_REGEX = /rangeE([[(])([^,]*),([^)\]]*)([)\]])/
const RANGE_NUMERIC_MATCHER_REGEX_INT = /rangeN([[(])\s*(-?\d*)\s*,\s*(-?\d*)\s*([)\]])/
const RANGE_NUMERIC_MATCHER_REGEX_FLOAT = /rangeF([[(])\s*?(-?\d+\.\d+)?\s*,\s*(-?\d+\.\d+)?\s*([)\]])/
/*
 range(aaa,bbb)
 range[aaa,bbb)
 range(, x)
 range( y, ]
 */

const CompareIntFn: CompareFn<number> = (a: number, b: number) => a - b
const CompareFloatFn: CompareFn<number> = (a: number, b: number) => a - b
type MDVConverter<T extends SN> = (s: string) => SNResult<T>

enum RangeEdgeType { INCLUSIVE, EXCLUSIVE}
function getRangeMatcherFn<T extends SN>(specsMatch: RegExpMatchArray, compareFn: CompareFn<SNResult<T>>, mdvConverter: MDVConverter<T>) {
    const RANGE_START_TYPE_IDX = 1
    const RANGE_START_IDX = 2
    const RANGE_END_IDX = 3
    const RANGE_END_TYPE_IDX = 4
    const rangeStartType: RangeEdgeType = specsMatch[RANGE_START_TYPE_IDX] === '(' ? RangeEdgeType.EXCLUSIVE : RangeEdgeType.INCLUSIVE
    const rangeStartValue: SNResult<T> = mdvConverter(specsMatch[RANGE_START_IDX].trim())
    const rangeEndValue: SNResult<T> = mdvConverter(specsMatch[RANGE_END_IDX].trim())
    const rangeEndType: RangeEdgeType = specsMatch[RANGE_END_TYPE_IDX] === ')' ? RangeEdgeType.EXCLUSIVE : RangeEdgeType.INCLUSIVE
    return (mdataValue: string): boolean => {
        let rangeStartMatched = true
        const mdv: SNResult<T>  = mdvConverter(mdataValue)
        if (rangeStartValue) {
            if (rangeStartType === RangeEdgeType.INCLUSIVE) {
                rangeStartMatched = compareFn (mdv, rangeStartValue) >= 0
            } else {
                rangeStartMatched = compareFn (mdv, rangeStartValue) > 0
            }
        }
        let rangeEndMatched = true
        if (rangeEndValue) {
            if (rangeEndType === RangeEdgeType.INCLUSIVE) {
                rangeEndMatched = compareFn (mdv, rangeEndValue) <= 0
            } else {
                rangeEndMatched = compareFn (mdv, rangeEndValue) < 0
            }
        }

        return rangeStartMatched && rangeEndMatched
    }
}

const ValueMatchers: ValueMatcherSpec<SN>[] = [
    {   specPattern: VALUE_MATCHER_REGEX,
        valueMatcherFnFactory: getPlainValueMatcherFn,
        compareFn: CollatorCompare,
        unitTestsId: 'value'
    }, {
        specPattern: VALUE_TRUE_ALPHABETIC_MATCHER_REGEX,
        valueMatcherFnFactory: getPlainValueMatcherFn,
        compareFn: CollatorTrueAlphabeticalCompare,
        unitTestsId: 'valueE'
    }, {
        specPattern: RANGE_MATCHER_REGEX,
        valueMatcherFnFactory: getRangeMatcherFn,
        compareFn: CollatorCompare,
        unitTestsId: 'range'
    },{
        specPattern: RANGE_TRUE_ALPHABETIC_MATCHER_REGEX,
        valueMatcherFnFactory: getRangeMatcherFn,
        compareFn: CollatorTrueAlphabeticalCompare,
        unitTestsId: 'rangeE'
    },{
        specPattern: RANGE_NUMERIC_MATCHER_REGEX_INT,
        valueMatcherFnFactory: getRangeMatcherFn,
        compareFn: CompareIntFn,
        mdvConterter: (s: string) => ~~s,
        unitTestsId: 'rangeN'
    },{
        specPattern: RANGE_NUMERIC_MATCHER_REGEX_FLOAT,
        valueMatcherFnFactory: getRangeMatcherFn,
        compareFn: CompareFloatFn,
        mdvConterter: (s: string) => parseFloat(s),
        unitTestsId: 'rangeF'
    }, {
        specPattern: 'any-value',  // Artificially added for testing purposes
        valueMatcherFnFactory: () => (s: string) => true,
        compareFn: CollatorCompare, // Not used
        unitTestsId: 'any-value-explicit'
    }
]

export const tryParseAsMDataMatcherSpec = (s: string): MDataMatcherParseResult|undefined => {
    // Simplistic initial implementation of the idea, not closing the way to more complex implementations
    for (const matcherSpec of ValueMatchers) {
        if ('string' === typeof matcherSpec.specPattern && s.trim().startsWith(matcherSpec.specPattern)) {
            return {
                m: matcherSpec.valueMatcherFnFactory(matcherSpec.specPattern, matcherSpec.compareFn, (s: string) => s ),
                remainder: s.substring(matcherSpec.specPattern.length).trim()
            }
        } else { // regexp
            const match = s.match(matcherSpec.specPattern)
            if (match) {
                return {
                    m: matcherSpec.valueMatcherFnFactory(match, matcherSpec.compareFn, matcherSpec.mdvConterter ?? (s => s)),
                    remainder: s.substring(match[0].length).trim()
                }
            }
        }
    }
    return undefined
}

export const _unitTests = {
    matcherFn_value: ValueMatchers.find((it) => it.unitTestsId === 'value'),
    matcherFn_range: ValueMatchers.find((it) => it.unitTestsId === 'range'),
    matcherFn_rangeE: ValueMatchers.find((it) => it.unitTestsId === 'rangeE'),
    matcherFn_rangeN: ValueMatchers.find((it) => it.unitTestsId === 'rangeN'),
    matcherFn_rangeF: ValueMatchers.find((it) => it.unitTestsId === 'rangeF'),
    matcherFn_anyValue: ValueMatchers.find((it) => it.unitTestsId === 'any-value-explicit'),
}
