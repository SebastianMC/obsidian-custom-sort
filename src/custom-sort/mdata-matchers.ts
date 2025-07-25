import {
    getNormalizedDate_NormalizerFn_for
} from "./matchers";
import {NormalizerFn} from "./custom-sort-types";
import {CollatorCompare, CollatorTrueAlphabeticalCompare} from "./custom-sort";
import {
    SNB,
    MDVConverter,
    SpecValueConverter,
    ValueConverters
} from "./value-converters";

type MDataValueType = string|number|boolean|Array<any>
export interface MDataMatcher {
    (mdataValue: MDataValueType|undefined): boolean
}

export type SorNorB<T = SNB> = T extends number ? number : (T extends string ? string : boolean)
export type CompareFn<T = SNB> = (a: T, b: T) => number

export interface MDataMatcherFactory<T extends SNB> {
    (specsMatch: string|RegExpMatchArray,
     compareFn: CompareFn<SorNorB<T>>,
     //mdvConverter: MDVConverter<SorNorB<T>>,
     //typeRepresentative: SorNorB<T>
     ): MDataMatcher|undefined
}

interface ValueMatcherSpec<T extends SNB> {
    specPattern: string|RegExp,
    valueMatcherFnFactory: MDataMatcherFactory<SorNorB<T>>
    compareFn: CompareFn<SorNorB<T>>
    //mdvConterter: MDVConverter<SorNorB<T>>
    unitTestsId: string
}

// Syntax sugar to enforce TS type checking on matchers configurations
function newStingValueMatcherSpec(vc: ValueConverters, unitTestId: string, regex: RegExp, trueAlphabetical?: boolean): ValueMatcherSpec<string> {
    return {
        specPattern: regex,
        valueMatcherFnFactory: getPlainValueMatcherFnFactory<string>(vc, vc.specToStringConverter.bind(vc), '' /* type representative */),
        compareFn: trueAlphabetical ? CollatorTrueAlphabeticalCompare : CollatorCompare,
        unitTestsId: unitTestId
    }
}
function newNumberValueMatcherSpec(vc: ValueConverters, unitTestId: string, regex: RegExp, representative: number): ValueMatcherSpec<number> {
    return {
        specPattern: regex,
        valueMatcherFnFactory: getPlainValueMatcherFnFactory<number>(
            vc,
            (representative == ~~representative) ? vc.specToIntConverter.bind(vc) : vc.specToFloatConverter.bind(vc),
            representative
        ),
        compareFn:  (representative == ~~representative) ? CompareIntFn : CompareFloatFn,
        unitTestsId: unitTestId
    }
}

function newBooleanValueMatcherSpec(vc: ValueConverters, unitTestId: string, regex: RegExp): ValueMatcherSpec<boolean> {
    return {
        specPattern: regex,
        valueMatcherFnFactory: getPlainValueMatcherFnFactory<boolean>(vc, vc.specToBooleanConverter.bind(vc), true /* type representative */),
        compareFn: CompareBoolFn,
        unitTestsId: unitTestId
    }
}

export interface MDataMatcherParseResult {
    m: MDataMatcher
    remainder: string
}

const VALUE_MATCHER_REGEX = /value\(([^)]*)\)/  // 001 === 1
const STR_VALUE_MATCHER_REGEX = /valueS\(([^)]*)\)/  // 001 === 1
const VALUE_MATCHER_WITH_DEFAULT_REGEX = /valueD\(([^:]*):([^)]+)\)/  // 001 === 1
const VALUE_TRUE_ALPHABETIC_MATCHER_REGEX = /valueE\(([^)]*)\)/  // 001 != 1
const VALUE_TRUE_ALPHABETIC_MATCHER_WITH_DEFAULT_REGEX = /valueED\(([^:]*):([^)]*)\)/  // 001 != 1

const INT_VALUE_MATCHER_REGEX = /valueN\((\s*([-+]?\d+(?:E[-+]?\d+)?)\s*)\)/i
const FLOAT_VALUE_MATCHER_REGEX = /valueF\(\s*([-+]?\d+\.\d+(?:E[-+]?\d+)?)\s*\)/i
const BOOL_VALUE_MATCHER_REGEX = /valueB\(\s*(true|false|yes|no|\d)\s*\)/i  // for \d only 0 or 1 are accepted, intentionally \d spec here

function getPlainValueMatcherFnFactory<T extends SNB>(vc: ValueConverters, specValueConverter: SpecValueConverter<SorNorB<T>>, theType: any): MDataMatcherFactory<T> {
    return (specsMatch: RegExpMatchArray, compareFn: CompareFn<SorNorB<T>>): MDataMatcher|undefined => {
        const EXACT_VALUE_IDX = 1 // Related to the spec regexp
        const DEFAULT_MDATA_VALUE_FOR_EMPTY_VALUE_IDX = 2 // Related to the spec regexp
        const expectedValueString: string|undefined = specsMatch[EXACT_VALUE_IDX] // Intentionally not trimming here - string matchers support spaces
        const expectedValue: SorNorB<T>|undefined = specValueConverter(expectedValueString)
        if (expectedValue===undefined) {
            return undefined  // syntax error in expected value in spec
        }
        let mdvConverter: MDVConverter<SorNorB<T>>|undefined = vc.getMdvConverters()[typeof theType]
        if (mdvConverter === undefined) {
            return undefined  // Error in the code, theType should be one of the supported types
        }
        return (mdataValue: MDataValueType | undefined): boolean => {
            const mdvToUse = mdataValue !== undefined ? mdataValue : specsMatch[DEFAULT_MDATA_VALUE_FOR_EMPTY_VALUE_IDX]?.trim()
            const mdv = mdvConverter(mdvToUse)
            if (mdv === undefined) {
                return false // empty metadata value does not match any expected value
            }
            return compareFn(mdv, expectedValue) === 0
        }
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
const CompareBoolFn: CompareFn<boolean> = (a: boolean, b: boolean) => a === b ? 0 : (a ? 1 : -1)

/*
enum RangeEdgeType { INCLUSIVE, EXCLUSIVE}
function getRangeMatcherFn<T extends SN>(specsMatch: RegExpMatchArray, compareFn: CompareFn<SorN<T>>, mdvConverter: MDVConverter<SorN<T>>) {
    const RANGE_START_TYPE_IDX = 1
    const RANGE_START_IDX = 2
    const RANGE_END_IDX = 3
    const RANGE_END_TYPE_IDX = 4
    const rangeStartType: RangeEdgeType = specsMatch[RANGE_START_TYPE_IDX] === '(' ? RangeEdgeType.EXCLUSIVE : RangeEdgeType.INCLUSIVE
    const rangeStartValue: SorN<T>|undefined = mdvConverter(specsMatch[RANGE_START_IDX]?.trim())
    const rangeEndValue: SorN<T>|undefined = mdvConverter(specsMatch[RANGE_END_IDX]?.trim())
    const rangeEndType: RangeEdgeType = specsMatch[RANGE_END_TYPE_IDX] === ')' ? RangeEdgeType.EXCLUSIVE : RangeEdgeType.INCLUSIVE
    return (mdataValue: string|undefined): boolean => {
        const mdv: SorN<T>|undefined  = mdvConverter(mdataValue?.trim())
        let rangeStartMatched = mdv!==undefined
        if (mdv!==undefined && rangeStartValue!==undefined) {  // rangeStartValue can be '0' or numeric 0
            if (rangeStartType === RangeEdgeType.INCLUSIVE) {
                rangeStartMatched = compareFn (mdv, rangeStartValue) >= 0
            } else {
                rangeStartMatched = compareFn (mdv, rangeStartValue) > 0
            }
        }
        let rangeEndMatched = mdv!==undefined
        if (mdv!==undefined && rangeEndValue!==undefined) { // rangeStartValue can be '0' or numeric 0
            if (rangeEndType === RangeEdgeType.INCLUSIVE) {
                rangeEndMatched = compareFn (mdv, rangeEndValue) <= 0
            } else {
                rangeEndMatched = compareFn (mdv, rangeEndValue) < 0
            }
        }

        return rangeStartMatched && rangeEndMatched
    }
}
*/

let valueMatchersCache: ValueMatcherSpec<SNB>[]|undefined = undefined

const valueConverters = new ValueConverters()

// Dependency injection of valueConverters for unit testing purposes
function getValueMatchers(vc?: ValueConverters) {
    return valueMatchersCache ??=  [
        newStingValueMatcherSpec(vc ?? valueConverters, 'value', VALUE_MATCHER_REGEX),
        newStingValueMatcherSpec(vc ?? valueConverters, 'valueS', STR_VALUE_MATCHER_REGEX),
        newStingValueMatcherSpec(vc ?? valueConverters, 'valueD', VALUE_MATCHER_WITH_DEFAULT_REGEX),
        newStingValueMatcherSpec(vc ?? valueConverters, 'valueE', VALUE_TRUE_ALPHABETIC_MATCHER_REGEX, true),
        newStingValueMatcherSpec(vc ?? valueConverters, 'valueED', VALUE_TRUE_ALPHABETIC_MATCHER_WITH_DEFAULT_REGEX, true),
        newNumberValueMatcherSpec(vc ?? valueConverters, 'valueN', INT_VALUE_MATCHER_REGEX, 1 /* type representative */),
        newNumberValueMatcherSpec(vc ?? valueConverters, 'valueF', FLOAT_VALUE_MATCHER_REGEX, 1.1 /* type representative */),
        newBooleanValueMatcherSpec(vc ?? valueConverters, 'valueB', BOOL_VALUE_MATCHER_REGEX),
        /*

            // Range matchers
            {
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
                mdvConterter:
                unitTestsId: 'rangeN'
            },{
                specPattern: RANGE_NUMERIC_MATCHER_REGEX_FLOAT,
                valueMatcherFnFactory: getRangeMatcherFn,
                compareFn: CompareFloatFn,
                mdvConterter:
                unitTestsId: 'rangeF'
            },*/ {
            specPattern: 'any-value',  // Artificially added for testing purposes
            valueMatcherFnFactory: () => (s: any) => true,
            compareFn: (a, b) => 0, // Not used
            unitTestsId: 'any-value-explicit'
        }
    ]
}

export const tryParseAsMDataMatcherSpec = (s: string): MDataMatcherParseResult|undefined => {
    // Simplistic initial implementation of the idea, not closing the way to more complex implementations
    for (const matcherSpec of getValueMatchers()) {
        if ('string' === typeof matcherSpec.specPattern && s.trim().startsWith(matcherSpec.specPattern)) {
            const mdMatcher: MDataMatcher|undefined = matcherSpec.valueMatcherFnFactory(matcherSpec.specPattern, matcherSpec.compareFn)
            return mdMatcher ? {
                m: mdMatcher,
                remainder: s.substring(matcherSpec.specPattern.length).trim()
            } : undefined
        } else { // regexp
            const match = s.match(matcherSpec.specPattern)
            if (match) {
                const mdMatcher: MDataMatcher|undefined = matcherSpec.valueMatcherFnFactory(match, matcherSpec.compareFn)
                return mdMatcher ? {
                    m: mdMatcher,
                    remainder: s.substring(match[0].length).trim()
                } : undefined
            }
        }
    }
    return undefined
}

export const _unitTests = {
    getMatchers(vc: ValueConverters) {
        const valueMatchers = getValueMatchers(vc)
        return {
            matcherFn_value: valueMatchers.find((it) => it.unitTestsId === 'value'),
            matcherFn_valueS: valueMatchers.find((it) => it.unitTestsId === 'valueS'),
            matcherFn_valueD: valueMatchers.find((it) => it.unitTestsId === 'valueD'),
            matcherFn_valueE: valueMatchers.find((it) => it.unitTestsId === 'valueE'),
            matcherFn_valueED: valueMatchers.find((it) => it.unitTestsId === 'valueED'),
            matcherFn_valueN: valueMatchers.find((it) => it.unitTestsId === 'valueN'),
            matcherFn_valueF: valueMatchers.find((it) => it.unitTestsId === 'valueF'),
            matcherFn_valueB: valueMatchers.find((it) => it.unitTestsId === 'valueB'),
            matcherFn_range: valueMatchers.find((it) => it.unitTestsId === 'range'),
            matcherFn_rangeE: valueMatchers.find((it) => it.unitTestsId === 'rangeE'),
            matcherFn_rangeN: valueMatchers.find((it) => it.unitTestsId === 'rangeN'),
            matcherFn_rangeF: valueMatchers.find((it) => it.unitTestsId === 'rangeF'),
            matcherFn_anyValue: valueMatchers.find((it) => it.unitTestsId === 'any-value-explicit'),
        }
    }
}
