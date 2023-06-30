import {expandMacros, expandMacrosInString} from "./macros";
import * as MacrosModule from './macros'
import {CustomSortGroup, CustomSortSpec} from "./custom-sort-types";

describe('expandMacrosInString', () => {
    it.each([
        ['', ''],
        ['123', '123'],
        ['  123  ', '  123  '],
        [' Abc{:%parent-folder-name%:}Def ', ' Abc{:%parent-folder-name%:}Def '],
        ['{:%parent-folder-name%:}Def ', '{:%parent-folder-name%:}Def '],
        [' Abc{:%parent-folder-name%:}', ' Abc{:%parent-folder-name%:}'],
        [' {:%parent-folder-name%:} xyz {:%parent-folder-name%:}', ' {:%parent-folder-name%:} xyz {:%parent-folder-name%:}'],
        [' {:%unknown%:} ',' {:%unknown%:} ']
    ])('%s should transform to %s when no parent folder', (source: string, expanded: string) => {
        const result1 = expandMacrosInString(source)
        const result2 = expandMacrosInString(source, '')
        expect(result1).toBe(expanded)
        expect(result2).toBe(expanded)
    })
    it.each([
        ['', ''],
        ['123', '123'],
        ['  123  ', '  123  '],
        [' Abc{:%parent-folder-name%:}Def ', ' AbcSubFolder 5Def '],
        ['{:%parent-folder-name%:}Def ', 'SubFolder 5Def '],
        [' Abc{:%parent-folder-name%:}', ' AbcSubFolder 5'],
        [' {:%parent-folder-name%:} xyz {:%parent-folder-name%:}', ' SubFolder 5 xyz {:%parent-folder-name%:}'],
        [' {:%unknown%:} ',' {:%unknown%:} ']
    ])('%s should transform to %s when parent folder specified', (source: string, expanded: string) => {
        const PARENT = 'SubFolder 5'
        const result = expandMacrosInString(source, PARENT)
        expect(result).toBe(expanded)
    })
})

function mockGroup(gprefix: string, group: string, prefix: string, full: string, suffix: string): CustomSortGroup {
    const g: Partial<CustomSortGroup> = {
        exactText: gprefix + group + full,
        exactPrefix: gprefix + group + prefix,
        exactSuffix: gprefix + group + suffix
    }
    return g as CustomSortGroup
}

describe('expandMacros', () => {
    it('should expand in all relevant text fields on all groups', () => {
        const sortSpec: Partial<CustomSortSpec> = {
            groups: [
                mockGroup('g-', '1-', 'abc', 'def', 'ghi'),
                mockGroup('g-', '2-', 'abc', 'def', 'ghi'),
            ],
            groupsShadow: [
                mockGroup('gs-', '1-', 'abc', 'def', 'ghi'),
                mockGroup('gs-', '2-', 'abc', 'def', 'ghi'),
            ]
        }
        const sp = jest.spyOn(MacrosModule, 'expandMacrosInString')
        const ParentFolder = 'Parent folder name'
        expandMacros(sortSpec as CustomSortSpec, ParentFolder)
        expect(sp).toBeCalledTimes(6)
        expect(sp).toHaveBeenNthCalledWith(1, 'gs-1-def', ParentFolder)
        expect(sp).toHaveBeenNthCalledWith(2, 'gs-1-abc', ParentFolder)
        expect(sp).toHaveBeenNthCalledWith(3, 'gs-1-ghi', ParentFolder)
        expect(sp).toHaveBeenNthCalledWith(4, 'gs-2-def', ParentFolder)
        expect(sp).toHaveBeenNthCalledWith(5, 'gs-2-abc', ParentFolder)
        expect(sp).toHaveBeenNthCalledWith(6, 'gs-2-ghi', ParentFolder)
    })
})
