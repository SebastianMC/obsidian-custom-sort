import {
    getNormalizedDate_NormalizerFn_for
} from "./matchers";
import {NormalizerFn} from "./custom-sort-types";

export interface MDataMatcher {
    (mdataValue: string): boolean
}

export interface MDataMatcherFactory {
    (specsMatch: string|RegExpMatchArray): MDataMatcher
}

interface ValueMatcherSpec {
    specPattern: string|RegExp,
    valueMatcherFnFactory: MDataMatcherFactory
    unitTestsId: string
}

export interface MDataMatcherParseResult {
    m: MDataMatcher
    remainder: string
}

const VALUE_MATCHER_REGEX = /value\(([^)]+)\)/
function getPlainValueMatcherFn(specsMatch: RegExpMatchArray) {
    const EXACT_VALUE_IDX = 1 // Related to the spec regexp
    const expectedValue = specsMatch[EXACT_VALUE_IDX].trim()
    return (mdataValue: string): boolean => {
        return mdataValue === expectedValue
    }
}

const RANGE_MATCHER_REGEX = /range([[(])([^,]*),([^)\]]*)([)\]])/
/*
 range(aaa,bbb)
 range[aaa,bbb)
 range(, x)
 range( y, ]
 */
enum RangeEdgeType { INCLUSIVE, EXCLUSIVE}
function getRangeMatcherFn(specsMatch: RegExpMatchArray) {
    const RANGE_START_TYPE_IDX = 1
    const RANGE_START_IDX = 2
    const RANGE_END_IDX = 3
    const RANGE_END_TYPE_IDX = 4
    const rangeStartType: RangeEdgeType = specsMatch[RANGE_END_TYPE_IDX] === '(' ? RangeEdgeType.EXCLUSIVE : RangeEdgeType.INCLUSIVE
    const rangeStartValue: string = specsMatch[RANGE_START_IDX].trim()
    const rangeEndValue: string = specsMatch[RANGE_END_IDX].trim()
    const rangeEndType: RangeEdgeType = specsMatch[RANGE_END_TYPE_IDX] === ')' ? RangeEdgeType.EXCLUSIVE : RangeEdgeType.INCLUSIVE
    return (mdataValue: string): boolean => {
        let rangeStartMatched = true
        if (rangeStartValue) {
            if (rangeStartType === RangeEdgeType.INCLUSIVE) {
                rangeStartMatched = mdataValue >= rangeStartValue
            } else {
                rangeStartMatched = mdataValue > rangeStartValue
            }
        }
        let rangeEndMatched = true
        if (rangeEndValue) {
            if (rangeEndType === RangeEdgeType.INCLUSIVE) {
                rangeEndMatched = mdataValue <= rangeEndValue
            } else {
                rangeEndMatched = mdataValue < rangeEndValue
            }
        }

        return  rangeStartMatched && rangeEndMatched
    }
}

const ValueMatchers: ValueMatcherSpec[] = [
    {   specPattern: VALUE_MATCHER_REGEX,
        valueMatcherFnFactory: getPlainValueMatcherFn,
        unitTestsId: 'value'
    }, {
        specPattern: RANGE_MATCHER_REGEX,
        valueMatcherFnFactory: getRangeMatcherFn,
        unitTestsId: 'range'
    }, {
        specPattern: 'any-value',  // Artificially added for testing purposes
        valueMatcherFnFactory: () => (s: string) => true,
        unitTestsId: 'any-value-explicit'
    }
]

export const tryParseAsMDataMatcherSpec = (s: string): MDataMatcherParseResult|undefined => {
    // Simplistic initial implementation of the idea, not closing the way to more complex implementations
    for (const matcherSpec of ValueMatchers) {
        if ('string' === typeof matcherSpec.specPattern && s.trim().startsWith(matcherSpec.specPattern)) {
            return {
                m: matcherSpec.valueMatcherFnFactory(matcherSpec.specPattern),
                remainder: s.substring(matcherSpec.specPattern.length).trim()
            }
        } else { // regexp
            const match = s.match(matcherSpec.specPattern)
            if (match) {
                return {
                    m: matcherSpec.valueMatcherFnFactory(match),
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
    matcherFn_anyValue: ValueMatchers.find((it) => it.unitTestsId === 'any-value-explicit'),
}
