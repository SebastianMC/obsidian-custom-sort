import {ValueConverters} from '../../custom-sort/value-converters'
import {
    tryParseAsMDataMatcherSpec,
    _unitTests
} from '../../custom-sort/mdata-matchers'

let valueConverters: ValueConverters

// Wrap the ValueConverters to check if they are called
function mockValueConverters() {
    if (!valueConverters) {
        valueConverters = new ValueConverters()
        valueConverters.toBooleanConverter = jest.fn(valueConverters.toBooleanConverter)
        valueConverters.specToBooleanConverter = jest.fn(valueConverters.specToBooleanConverter)
        valueConverters.toStringConverter = jest.fn(valueConverters.toStringConverter)
        valueConverters.specToStringConverter = jest.fn(valueConverters.specToStringConverter)
        valueConverters.toIntConverter = jest.fn(valueConverters.toIntConverter)
        valueConverters.specToIntConverter = jest.fn(valueConverters.specToIntConverter)
        valueConverters.toFloatConverter = jest.fn(valueConverters.toFloatConverter)
        valueConverters.specToFloatConverter = jest.fn(valueConverters.specToFloatConverter)

        // Populate initial module cache
        _unitTests.getMatchers(valueConverters)
    }
    jest.clearAllMocks()
}

/* Convenience syntax sugar */
const R /* Result type*/ = {
    MATCH: 'spec ok, match',
    NO_MATCH: 'spec ok, no-match',
    Err: {
        SPEC_SYNTAX: 'spec syntax error',
        SPEC_VALUE: 'spec value error',
    }
}

describe('MDataMatcher - exact value matchers', () => {
    it('value(...) should correctly parse plain value matcher and do the matching - plain syntax', () => {
        const matcher = tryParseAsMDataMatcherSpec('value(testValue)')
        expect(matcher!).toBeDefined()
        expect(matcher!.m('testValue')).toBe(true)
        expect(matcher!.m('otherValue')).toBe(false)
        expect(matcher!.remainder).toBe('')
    })
    it('value(...) should correctly parse plain value matcher and do the matching - syntax with spaces', () => {
        const result = tryParseAsMDataMatcherSpec('value(  test value   )   ')
        expect(result).toBeDefined()
        expect(result!.m('test value')).toBe(true)
        expect(result!.m('other value')).toBe(false)
        expect(result!.m('')).toBe(false)
        expect(result!.remainder).toBe('')
    })
    it('value(...) should correctly parse plain value matcher and do the matching - syntax with spaces and remainder', () => {
        const result = tryParseAsMDataMatcherSpec('value(  test Value   )   some remainder')
        expect(result).toBeDefined()
        expect(result!.m('test Value')).toBe(true)
        expect(result!.m('otherValue')).toBe(false)
        expect(result!.remainder).toBe('some remainder')
    })
    it('value(...) should correctly parse plain value matcher and do the matching - numbers', () => {
        const matcher = tryParseAsMDataMatcherSpec('value(123.01)')
        expect(matcher!).toBeDefined()
        expect(matcher!.m('123.01')).toBe(true)
        expect(matcher!.m('123.1')).toBe(true)
        expect(matcher!.m('0123.01')).toBe(true)
        expect(matcher!.m('00123.000')).toBe(false)
        expect(matcher!.m('0000123.0001')).toBe(true)
        expect(matcher!.remainder).toBe('')
    })
    it('valueE(...) should correctly parse plain value matcher and do the matching - numbers and true alphabetical comparison', () => {
        const matcher = tryParseAsMDataMatcherSpec('valueE(123.01)')
        expect(matcher!).toBeDefined()
        expect(matcher!.m('123.01')).toBe(true)
        expect(matcher!.m('123.1')).toBe(false)
        expect(matcher!.m('0123.01')).toBe(false)
        expect(matcher!.m('00123.000')).toBe(false)
        expect(matcher!.m('0000123.0001')).toBe(false)
        expect(matcher!.remainder).toBe('')
    })
    it('value(...) should reject error empty value spec', () => {
        const result = tryParseAsMDataMatcherSpec('value()')
        expect(result).toBeUndefined()
    })

    it('should correctly parse any-value matcher', () => {
        const result = tryParseAsMDataMatcherSpec('any-value')
        expect(result).toBeDefined()
        expect(result!.m('anyValue')).toBe(true)
        expect(result!.m('anotherValue')).toBe(true)
        expect(result!.m('')).toBe(true)
        expect(result!.remainder).toBe('')
    })

    it('should return undefined for unknown matcher', () => {
        const result = tryParseAsMDataMatcherSpec('unknown-matcher')
        expect(result).toBeUndefined()
    })
})

describe('MDataMatcher - exact value matchers - syntax errors', () => {
    it.each([
        'value()',
        'valueS()',
        'valueD()',
        'valueE()',
        'valueED()',
        'valueN()',
        'valueF()',
        'valueF(-1000)',
        'valueB()',
    ])('should correctly reject syntax error in %s', (spec) => {
        const matcher = tryParseAsMDataMatcherSpec(spec)
        expect(matcher).toBeUndefined()
    })
})

describe('MDataMatcher - value*() - test-as-specification cases', () => {
    it.each([
        ['value( )', ' ',],
        ['value(  )', '  '],
        ['valueS( )', ' '],
        ['valueS(  )', '  '],
        ['valueD(100:00100)', undefined],
        ['valueD(100:00100)', undefined],
        ['valueD(abc:abc)', undefined],
        ['valueE)', ''],
        ['valueED()', ''],
        ['valueN()', ''],
        ['valueF(1000.00000)', 1000],
        ['valueF(1000.00000)', 1000.0000000000],
        ['valueF(-1000.0)', -1000],
        ['valueF(-1000.0)', '-1.0e3'],
        ['valueF(-1000.0)', -1.0e3],
        ['valueF(-1000.0)', -1.0e+3],
        ['valueF(1.0)', true],
        ['valueF(0.0)', false],
        ['valueB()', ''],
        ['valueB()', ''],
        ['valueB()', undefined],
        ['valueB()', 1],
        ['valueB(true)', true],
        ['valueB()', ['a', 1, false]],
    ])('the %s should match %s', (spec, mdv ) => {
        mockValueConverters()
        const matcher = tryParseAsMDataMatcherSpec(spec)
        expect(matcher).toBeDefined()
        expect(matcher!.m(mdv)).toBeTruthy()
        expect(matcher!.remainder).toBe('')
        expect(valueConverters.specToBooleanConverter).toHaveBeenCalled()
        expect(valueConverters.toBooleanConverter).toHaveBeenCalled()
    })

    it.each([
        ['valueB(trUe  )', true, R.MATCH],
        ['valueB(  falsE)', false, R.MATCH],
        ['valueB(yEs)', true, R.MATCH],
        ['valueB(No)', false, R.MATCH],
        ['valueB(true)', ['a', 1, false], R.NO_MATCH],
        ['valueB(false)', ['a', 1, false], R.NO_MATCH],
        ['valueB(1)', true, R.MATCH],
        ['valueB(0)', false, R.MATCH],
        ['valueB(0)', true, R.NO_MATCH],
        ['valueB(1)', false, R.NO_MATCH],
        ['valueB()', undefined, R.Err.SPEC_SYNTAX],
        ['valueB(abc)', undefined, R.Err.SPEC_SYNTAX],
        ['valueB( unknown )', undefined, R.Err.SPEC_SYNTAX],
        ['valueB(5)', undefined, R.Err.SPEC_VALUE],
        ['valueB(9)', undefined, R.Err.SPEC_VALUE],
    ])('valueB: the %s spec and %s - case type (%s)', (spec, mdv, caseType: string) => {
        mockValueConverters()
        const matcher = tryParseAsMDataMatcherSpec(spec)
        if (caseType === R.Err.SPEC_SYNTAX) {
            expect(matcher).toBeUndefined()
            expect(valueConverters.specToBooleanConverter).toHaveBeenCalledTimes(0)
            expect(valueConverters.toBooleanConverter).toHaveBeenCalledTimes(0)
        } else if (caseType === R.Err.SPEC_VALUE) {
            expect(matcher).toBeUndefined()
            expect(valueConverters.specToBooleanConverter).toHaveBeenCalledTimes(1)
            expect(valueConverters.toBooleanConverter).toHaveBeenCalledTimes(1)
        } else {
            expect(matcher).toBeDefined()
            expect(matcher!.remainder).toBe('')
            expect(valueConverters.specToBooleanConverter).toHaveBeenCalledTimes(1)
            expect(valueConverters.toBooleanConverter).toHaveBeenCalledTimes(1)
            if (caseType === R.MATCH) {
                expect(matcher!.m(mdv)).toBeTruthy()
            } else if (caseType === R.NO_MATCH) {
                expect(matcher!.m(mdv)).toBeFalsy()
            } else {
                expect('Invalid test case').toBeFalsy()
            }
            expect(valueConverters.specToBooleanConverter).toHaveBeenCalledTimes(1)
            expect(valueConverters.toBooleanConverter).toHaveBeenCalledTimes(2)
        }
    })

    it.each([
        // value() and valueD() (string alphanumeric comparison)
        ['value()', '', R.MATCH],
        ['valueS()', '', R.MATCH],
        ['value( )', ' ', R.MATCH],
        ['value()', '   ', R.NO_MATCH],
        ['value(   )', '', R.NO_MATCH],
        ['valueS(   )', '', R.NO_MATCH],
        ['value(Abc)', 'Abc', R.MATCH],
        ['value(Abc)', 'ABC', R.MATCH],
        ['value(Abc)', ' Abc ', R.NO_MATCH],
        ['value(Abc)', 'Abcd', R.NO_MATCH],
        ['value(123)', 123, R.MATCH],
        ['value(  123)', 123, R.NO_MATCH],
        ['value(0123)', 123, R.MATCH],
        ['value(0123.456)', 123.456, R.MATCH],
        ['valueS(0123.456)', 123.456, R.MATCH],
        ['value(false)', false, R.MATCH],
        ['value(TrUe)', true, R.MATCH],
        ['value(  TrUe  )', true, R.NO_MATCH],
        ['value(true)', ['a', 1, false], R.NO_MATCH],
        ['value(false)', ['a', 1, false], R.NO_MATCH],
        ['value()', undefined, R.NO_MATCH],
        ['value(undefined)', undefined, R.NO_MATCH],
        ['value(0123.456.000)', 123.456, R.NO_MATCH],
        ['value(0123.456.001)', 123.456, R.NO_MATCH],
        ['value(0)', '0', R.MATCH],
        ['value(0)', '00000', R.MATCH],
        ['valueS(0)', '00000', R.MATCH],
        ['value(0)', 0, R.MATCH],
        ['value(0)', '', R.NO_MATCH],
        ['valueD(0:0)', '', R.NO_MATCH],
        ['valueD(0:0)', undefined, R.MATCH],
        ['value(0)', '', R.NO_MATCH],
        ['value(1)', '', R.NO_MATCH],
          // For string matching there are no syntax errors in the spec by definition
        //['value()', '', R.Err.SPEC_SYNTAX],
        //['value(abc)', '', R.Err.SPEC_SYNTAX],
        //['value( unknown )', '', R.Err.SPEC_SYNTAX],
        //['value(5)', '', R.Err.SPEC_VALUE],
        //['value(9)', '', R.Err.SPEC_VALUE],

        // valeE() and valueED() (string true alphabetical comparison)
        ['valueE()', '', R.MATCH],
        ['valueE()', undefined, R.NO_MATCH],
        ['valueED(:)', '', R.MATCH],
        ['valueED(:)', undefined, R.MATCH],
        ['valueE( )', ' ', R.MATCH],
        ['valueE()', '   ', R.NO_MATCH],
        ['valueE(   )', '', R.NO_MATCH],
        ['valueE(Abc)', 'Abc', R.MATCH],
        ['valueE(Abc)', 'ABC', R.MATCH],
        ['valueE(Abc)', ' Abc ', R.NO_MATCH],
        ['valueE(Abc)', 'Abcd', R.NO_MATCH],
        ['valueE(123)', 123, R.MATCH],
        ['valueE(  123)', 123, R.NO_MATCH],
        ['valueE(0123)', 123, R.NO_MATCH],
        ['valueE(0123.456)', 123.456, R.NO_MATCH],
        ['valueE(123.0456)', 123.456, R.NO_MATCH],
        ['valueE(false)', false, R.MATCH],
        ['valueE(TrUe)', true, R.MATCH],
        ['valueE(  TrUe  )', true, R.NO_MATCH],
        ['valueE(true)', ['a', 1, false], R.NO_MATCH],
        ['valueE(false)', ['a', 1, false], R.NO_MATCH],
        ['valueE()', undefined, R.NO_MATCH],
        ['valueE(undefined)', undefined, R.NO_MATCH],
        ['valueE(0123.456.000)', 123.456, R.NO_MATCH],
        ['valueE(0123.456.001)', 123.456, R.NO_MATCH],
        ['valueE(0)', '0', R.MATCH],
        ['valueE(0)', '00000', R.NO_MATCH],
        ['valueED(0:0)', '00000', R.NO_MATCH],
        ['valueE(0)', 0, R.MATCH],
        ['valueE(0)', '', R.NO_MATCH],
        ['valueED(0:000)', '', R.NO_MATCH],
        ['valueED(0:000)', undefined, R.NO_MATCH],
        ['valueED(000:000)', undefined, R.MATCH],
        ['valueE(0)', '', R.NO_MATCH],
        ['valueE(1)', '', R.NO_MATCH],

    ])('value*: the %s spec and >%s< - case type (%s)', (spec, mdv, caseType: string) => {
        mockValueConverters()
        const matcher = tryParseAsMDataMatcherSpec(spec)
        if (caseType === R.Err.SPEC_SYNTAX) {
            expect(matcher).toBeUndefined()
            expect(valueConverters.specToStringConverter).toHaveBeenCalledTimes(0)
            expect(valueConverters.toStringConverter).toHaveBeenCalledTimes(0)
        } else if (caseType === R.Err.SPEC_VALUE) {
            expect(matcher).toBeUndefined()
            expect(valueConverters.specToStringConverter).toHaveBeenCalledTimes(1)
            expect(valueConverters.toStringConverter).toHaveBeenCalledTimes(0)
        } else {
            expect(matcher).toBeDefined()
            expect(matcher!.remainder).toBe('')
            expect(valueConverters.specToStringConverter).toHaveBeenCalledTimes(1)
            expect(valueConverters.toStringConverter).toHaveBeenCalledTimes(0) // specToStringConverter doesn't need string-to-string conversion
            if (caseType === R.MATCH) {
                expect(matcher!.m(mdv)).toBeTruthy()
            } else if (caseType === R.NO_MATCH) {
                expect(matcher!.m(mdv)).toBeFalsy()
            } else {
                expect('Invalid test case').toBeFalsy()
            }
            expect(valueConverters.specToStringConverter).toHaveBeenCalledTimes(1)
            expect(valueConverters.toStringConverter).toHaveBeenCalledTimes(1)
        }
    })

    it('value()) - closing parenthesis is not part of value, it is the ignored remainder', () => {
        const matcher = tryParseAsMDataMatcherSpec('value())')
        expect(matcher).toBeDefined()
        expect(matcher!.remainder).toBe(')')
        expect(matcher!.m('')).toBeTruthy()
    })


})

describe('MDataMatcher - value*() - test-as-specification negative cases', () => {
    it.each([
        ['value( )', '  ',],
        ['value(  )', ' '],
        ['valueS( )', '  '],
        ['valueS(  )', ' '],
        ['valueD(abc:abc)', ' '],
        ['valueD(abc:abc)', ''],
        ['valueE)', ''],
        ['valueED()', ''],
        ['valueN()', ''],
        ['valueF()', ''],
        ['valueB()', ''],
        ['valueB()', ''],
        ['valueB()', undefined],
        ['valueB()', 1],
        ['valueB()', true],
        ['valueB()', ['a', 1, false]],
    ])('the %s should NOT match %s', (spec, mdv ) => {
        const matcher = tryParseAsMDataMatcherSpec(spec)
        expect(matcher).toBeDefined()
        expect(matcher!.m(mdv)).toBeFalsy()
        expect(matcher!.remainder).toBe('')
    })
})

describe('MDataMatcher - range matcher', () => {
    it.each([
        // Default alphabetical comparison
        ['range[aaa,bbb)', 'aaa', true],
        ['range[ aaa, bbb)', 'aax', true],
        ['range[aaa  ,bbb  )', 'aa', false],
        ['range[ aaa , bbb )', 'bbb', false],
        ['range(  aaa,bbb]', 'aaaa', true],
        ['range(aaa  ,bbb]', 'bbb', true],
        ['range(aaa,  bbb]', 'aaa', false],
        ['range(  aaa  ,  bbb  ]', 'bbc', false],
        ['range(,456)', '1', true],
        ['range(,456)', '456', false],
        ['range(,456)', '0456', false],
        ['range(,456)', '1000', false],
        ['range(123,)', '1', false],
        ['range(123,)', '01', false],
        ['range(123,)', '123', false],
        ['range(123,)', '0123', false],
        ['range(123,)', '1000', true],

        // True alphabetical comparison
        ['rangeE(,456)', '1', true],
        ['rangeE(,456)', '456', false],
        ['rangeE(,456)', '0456', true],
        ['rangeE(,456)', '1000', true],
        ['rangeE(123,)', '1', false],
        ['rangeE(123,)', '01', false],
        ['rangeE(123,)', '123', false],
        ['rangeE(123,)', '124', true],
        ['rangeE(123,)', '0123', false],
        ['rangeE(123,)', '1000', false],

        // Trickier cases
        ['range[2025-02-17,2025-02-17]', '2025-02-17', true],
        ['range[2025-02-17,2025-02-17]', '2025-2-17', true],
        ['range[2025-02-17,2025-02-17]', '002025-2-017', true],

        ['rangeE[2025-02-17,2025-02-17]', '2025-02-17', true],
        ['rangeE[2025-02-17,2025-02-17]', '2025-2-17', false],
        ['rangeE[2025-02-17,2025-02-17]', '002025-2-017', false],

        // Edge cases
        ['range(1,1)', '1', false],
        ['range[1,1)', '1', false],
        ['range(1,1]', '1', false],
        ['range[1,1]', '1', true],
        ['range(,)', '1', true],
        ['range(,)', '', true],
        ['range(,)', 'anything', true],

        // range[-1,1] is not what you would expect, it is not numerical comparison
        ['range[-1,1]', '-10', true],
        ['range[-1,1]', '-2', true],
        ['range[-1,1]', '-1', true],
        ['range[-1,1]', '0', true],
        ['range[-1,1]', '1', true],
        ['range[-1,1]', '2', false],
    ])('should correctly parse range matcher %s and evaluate against %s', (spec, value, result) => {
        const matcher = tryParseAsMDataMatcherSpec(spec)
        expect(matcher).toBeDefined()
        expect(matcher!.m(value)).toBe(result)
        expect(matcher!.remainder).toBe('')
    })
    it.each([
        // Numerical ranges

        // rangeN[-1,1] is exactly what you would expect, numerical comparison
        ['rangeN[-1,1]', '-10', false],
        ['rangeN[-1,1)', '-2', false],
        ['rangeN[-1,1)', '-1', true],
        ['rangeN(-1,1)', '0', true],
        ['rangeN(-1,1]', '1', true],
        ['rangeN[-1,1]', '2', false],

            // tricky - mdata value interpreted as integer
        ['rangeN[-1,1]', '1.0', true],
        ['rangeN[-1,1]', '1.1', true],
        ['rangeN[-1,1]', '-1.2', true],

        // rangeF[-1.5,1.5] is numerical, floating point correct behavior
        ['rangeF[-1.0,1.0]', '-10', false],
        ['rangeF[-1.0,1.0]', '-1.0', true],
        ['rangeF[-1.0,1.0]', '-1.1', false],
        ['rangeF[-1.0,1.0]', '1.1', false],
        ['rangeF[-10.0,11.0]', '-10.1', false],
        ['rangeF(-1.0,1.0]', '-2', false],
        ['rangeF(-0.456,1.0]', '-0.455', true],
        ['rangeF(-0.456,2.0]', '-0.456', false],
        ['rangeF[-0.456,0.999]', '-0.456', true],
        ['rangeF(-0.456,444.4]', '-0.457', false],

        // reverse range spec - always false
        ['rangeF[1.0,-1.0]', '0', false],

        // partial ranges and zero as range
        ['rangeF(,123.0)', '0', true],
        ['rangeF[123.0,456.0]', '0', false],
        ['rangeF(456.0,)', '0', false],
        ['range(0,0)', '0', false],
        ['range[0,0]', '0', true],
        ['rangeN(0,0)', '0', false],
        ['rangeN[0,0]', '0', true],
        ['range(0,0)', '0', false],
        ['range[0,0]', '0', true],
        ['range(0,10)', '10', false],
        ['range[0,10]', '10', true],
        ['rangeN(0,10)', '10', false],
        ['rangeN[0,10]', '10', true],

        // NaN and non-float or not-numeric values
        ['rangeF[1000.1,1000.999]', '', false],
        ['rangeF[1000.1,1000.999]', 'abc', false],
        ['rangeF[1000.1,1000.999]', '+1000.12bvcs', true],
        ['rangeF[-1000.1,1000.999]', '-.0', true],
        ['rangeF[-1000.1,1000.999]', '0.', true],

    ])('should correctly parse numerical range matcher %s and evaluate against %s', (spec, value, result) => {
        const matcher = tryParseAsMDataMatcherSpec(spec)
        expect(matcher).toBeDefined()
        expect(matcher!.m(value)).toBe(result)
        expect(matcher!.remainder).toBe('')
    })
    it.each([
        // invalid rangeN full explicit [-]N format required
        'rangeN[1.,1]',
        'rangeN[1.,1.1]',
        'rangeN[1.1,1.]',
        'rangeN[-1.,1.]',
        'rangeN[-1.,-1.]',
        'rangeN[0,.1]',

        // invalid rangeF syntax - full explicit [-]N.N format required
        'rangeF[1,1]',
        'rangeF[1.,1.1]',
        'rangeF[1.1,1.]',
        'rangeF[-1.,1.]',
        'rangeF[-1.,-1.]',
        'rangeF[.0,.1]',
        'rangeF[.,1.0]',

    ])('should not parse not strictly formatted rangeN or rangeF matcher %s ', (spec) => {
        const matcher = tryParseAsMDataMatcherSpec(spec)
        expect(matcher).toBeUndefined()
    })
})

/*
Test cases coverage check list
1. Test converters, all cases
2. Test exact value matchers if they invoke the converter and the matching logic correctly, minimal cases

- string matcher:
  - true alphabetical
    - negative: numbers are treated literally hence 010 doesn't match 10
  - alphabetical
    - positive: 010 matches 10 and similar
    - negative: 020.030 doesn't match 20.3 and similar

- string matcher with default:
  - 2 positive cases: string,
  - 2 negative cases

- int matcher
  - positive: expecting int format, various examples (100, 00001, -000003, 0)
     - positive: partial parsing of string, e.g. 100.34 -> 100. 1000abc -> 1000, -3434xyz -> -3434
  - negative: invalid formats of spec, non-float values of mdata (strings not convertible to float, NaN, Infinity)

- float matcher
  - positive: expecting full float format plus scientific notation, various examples
  - negative: invalid formats of spec, non-float values of mdata (strings not convertible to float, NaN, Infinity)

- bool matcher
  - various conversions to bool
    - positive, in spec and in mdv
    - negative, in spec and in mdv

For ranges:
    - assume reuse of logic exact matches - can it be covered by test?
    - then only test the range logic itself


 */
