import {
    ValueConverters
} from '../../custom-sort/value-converters'

describe('toBooleanConverter', () => {
    let valueConverters: ValueConverters
    beforeAll(() => {
        valueConverters = new ValueConverters()
    })
    it.each([
        [true, true],
        [false, false],
        ['true', true],
        ['   true', true],
        ['True', true],
        ['True    ', true],
        ['TRUE', true],
        ['yes', true],
        ['    yes    ', true],
        ['Yes', true],
        ['yeS', true],
        ['no', false],
        ['No', false],
        ['NO', false],
        ['false', false],
        ['False', false],
        ['fALSE', false],
        [1, true],
        [1000, true],
        [-4356, true],
        [0, false],
        [0.0, false],
        [NaN, false],
        [Infinity, true],
        [-Infinity, true]
    ])('should correctly convert %s to boolean %s', (v, ev: boolean ) => {
        const bool = valueConverters.toBooleanConverter(v)
        expect(bool).toBe(ev)
    })
    it.each([
        '',
        '   ',
        '1',
        '0',
        '-',
        'true1',
        undefined,
        ['a','b'],  // metadata value in Obsidian can be also an array
    ])('should not convert %s to boolean', (v) => {
        const bool = valueConverters.toBooleanConverter(v)
        expect(bool).toBeUndefined()
    })
})

describe('toStringConverter', () => {
    let valueConverters: ValueConverters
    beforeAll(() => {
        valueConverters = new ValueConverters()
    })
    it.each([
        ['', ''],
        [' ', ' '],
        [false, 'false'],
        [true, 'true'],
        ['true', 'true'],
        ['   true', '   true'],
        ['    0    ', '    0    '],
        [1, '1'],
        [1000, '1000'],
        [-4356, '-4356'],
        [0, '0'],
        [0.001, '0.001'],

        // Tricky cases
        [0.0, '0'],
        [NaN, 'NaN'],
        [Infinity, 'Infinity'],
        [-Infinity, '-Infinity']
    ])('should correctly convert %s to string %s', (v, ev: string ) => {
        const bool = valueConverters.toStringConverter(v)
        expect(bool).toBe(ev)
    })
    it.each([
        undefined,
        ['a','b'],  // metadata value in Obsidian can be also an array
    ])('should not convert %s to string', (v) => {
        const bool = valueConverters.toStringConverter(v)
        expect(bool).toBeUndefined()
    })
})

describe('toFloatConverter', () => {
    let valueConverters: ValueConverters
    beforeAll(() => {
        valueConverters = new ValueConverters()
    })
    it.each([
        ['    0    ', 0],
        [1, 1],
        [1000, 1000],
        [-4356, -4356],
        [0, 0],
        [0.001, 0.001],
        [1E+3, 1000],
        ['-1E+3', -1000],
        ['1E-5', 0.00001],

        // Tricky cases
        [0.0, 0],
        [true, 1],
        [false, 0],
        ['0.1.2.3', 0.1],
        ['10 .1.2.3', 10],
        ['567abc', 567],
        ['567.890abc', 567.89],
    ])('should correctly convert %s to float %s', (v, ev: number ) => {
        const float = valueConverters.toFloatConverter(v)
        expect(float).toBe(ev)
    })
    it.each([
        '',
        '   ',
        undefined,
        NaN,
        Infinity,
        -Infinity,
        '-',
        '.',
        '-.',
        ['a','b'],  // metadata value in Obsidian can be also an array
    ])('should not convert %s to float', (v) => {
        const float = valueConverters.toFloatConverter(v)
        expect(float).toBeUndefined()
    })
})

describe('toIntConverter', () => {
    let valueConverters: ValueConverters
    beforeAll(() => {
        valueConverters = new ValueConverters()
    })
    it.each([
        ['    0    ', 0],
        [1, 1],
        [1000, 1000],
        [-4356, -4356],
        [0, 0],
        [0.001, 0],
        [1E+3, 1000],
        ['-1E+3', -1000],
        ['50E-5', 0],

        // Tricky cases
        [0.0, 0],
        [true, 1],
        [false, 0],
        ['0.1.2.3', 0],
        ['10 .1.2.3', 10],
        ['567abc', 567],
        ['567.890abc', 567],
    ])('should correctly convert %s to int %s', (v, ev: number ) => {
        const int = valueConverters.toIntConverter(v)
        expect(int).toBe(ev)
    })
    it.each([
        '',
        '   ',
        undefined,
        NaN,
        Infinity,
        -Infinity,
        '-',
        '.',
        '-.',
        ['a','b'],  // metadata value in Obsidian can be also an array
    ])('should not convert %s to int', (v) => {
        const int = valueConverters.toIntConverter(v)
        expect(int).toBeUndefined()
    })
})


