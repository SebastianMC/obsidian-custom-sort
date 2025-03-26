type MDataValueType = string|number|boolean|Array<any>
export interface MDataMatcher {
    (mdataValue: MDataValueType|undefined): boolean
}

export type SNB = string|number|boolean
export type SorNorB<T = SNB> = T extends number ? number : (T extends string ? string : boolean)
export type CompareFn<T = SNB> = (a: T, b: T) => number
export type MDVConverter<T = SNB> = (v: MDataValueType|undefined) => T|undefined
export type SpecValueConverter<T = SNB> = (s: string|undefined) => T|undefined  // undefined => syntax error in spec

const finiteNumber = (v: any): number|undefined => {
    return Number.isFinite(v) ? v : undefined
}

export interface ValueConvertersAPI {
    toIntConverter: MDVConverter<number>
    specToIntConverter: SpecValueConverter<number>
    toFloatConverter: MDVConverter<number>
    specToFloatConverter: SpecValueConverter<number>
    toBooleanConverter: MDVConverter<boolean>
    specToBooleanConverter: SpecValueConverter<boolean>
    toStringConverter: MDVConverter<string>
    specToStringConverter: SpecValueConverter<string>

    getMdvConverters: () => {[key: string]: MDVConverter<any>}
}

// To allow unit tests to access the converters and test them and invocations
export class ValueConverters implements ValueConvertersAPI {
    constructor() {
    }

    toIntConverter(v: MDataValueType | undefined) {
        if ('string' === typeof v) {
            const vAsFloat = parseFloat(v)   // We want to accept scientific notation as well: 1e3 => 1000
            return finiteNumber(vAsFloat) !== undefined ? ~~vAsFloat : undefined
        }
        if ('number' === typeof v) {
            if (Number.isInteger(v)) return v
            return finiteNumber(v) !== undefined ? ~~v : undefined
        }
        if ('boolean' === typeof v) {
            return v ? 1 : 0
        }
        return undefined  // We ignore metadata values of Array type
    }
    specToIntConverter(v: string | undefined){
        const trimmedTolV = v?.trim().toLowerCase()
        return this.toIntConverter(trimmedTolV)
    }
    toFloatConverter(v: MDataValueType | undefined) {
        if ('number' === typeof v) {
            return finiteNumber(v)
        }
        if ('string' === typeof v) {
            const trimmedV = v.trim()
            return trimmedV ? finiteNumber(parseFloat(v)) : undefined // empty string => undefined, unrecognized => NaN
        }
        if ('boolean' === typeof v) {
            return v ? 1 : 0
        }
        return undefined  // We ignore metadata values of Array type
    }
    specToFloatConverter(v: string | undefined) {
        const trimmedTolV: string | undefined = v?.trim().toLowerCase()
        return this.toFloatConverter(trimmedTolV)
    }
    toBooleanConverter(v: MDataValueType | undefined) {
        if ('boolean' === typeof v) {
            return v
        }
        if ('number' === typeof v) {
            return !!v   // Apply standard JS to-boolean conversion rules
        }
        if ('string' === typeof v) {
            const v2l = v.trim().toLowerCase()
            return (v2l === 'true' || v2l === 'yes') ? true : ((v2l === 'false' || v2l === 'no') ? false : undefined)
        }
        return undefined  // We ignore metadata values of Array type
    }
    specToBooleanConverter(v: string | undefined) {
        const v2l = v?.trim().toLowerCase()
        return this.toBooleanConverter(v2l)
    }
    toStringConverter(v: MDataValueType | undefined) {
        if ('string' === typeof v) {
            return v
        }
        if ('number' === typeof v || 'boolean' === typeof v) {
            return v.toString()
        }
        return undefined  // We ignore metadata values of Array type
    }
    specToStringConverter(v: string | undefined) {
        return v?.toLowerCase()
    }

    private _mdvConvertersCache: {[key: string]: MDVConverter<any>}
    getMdvConverters() {
        this._mdvConvertersCache = {
            string: this.toStringConverter,
            number: this.toFloatConverter,
            boolean: this.toBooleanConverter
        }
        this.getMdvConverters = this.getMdvConvertersFromCache
        return this.getMdvConvertersFromCache()
    }
    private getMdvConvertersFromCache() {
        return this._mdvConvertersCache
    }
}






