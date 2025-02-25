import {
    tryParseAsMDataMatcherSpec,
    _unitTests
} from '../../custom-sort/mdata-matchers'

describe('MDataMatcher', () => {
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
