import {
	CachedMetadata,
	MetadataCache,
	Pos, TAbstractFile,
	TFile,
	TFolder,
	Vault
} from 'obsidian';
import {
	DEFAULT_FOLDER_CTIME,
	DEFAULT_FOLDER_MTIME,
	determineFolderDatesIfNeeded,
	determineSortingGroup,
	EQUAL_OR_UNCOMPARABLE,
	FolderItemForSorting,
	getSorterFnFor,
	matchGroupRegex,
	ProcessingContext,
	sorterByBookmarkOrder,
	sorterByFolderCDate,
	sorterByFolderMDate,
	sorterByMetadataField,
	SorterFn
} from '../../custom-sort/custom-sort';
import {
	_unitTests
} from '../../custom-sort/custom-sort'
import {
	CustomSortGroupType,
	CustomSortOrder,
	CustomSortSpec,
	RegExpSpec
} from '../../custom-sort/custom-sort-types';
import {
	CompoundDashNumberNormalizerFn,
	CompoundDotRomanNumberNormalizerFn
} from "../../custom-sort/sorting-spec-processor";
import {
	BookmarksPluginInterface
} from "../../utils/BookmarksCorePluginSignature";
import {
	ObsidianIconFolder_PluginInstance,
	ObsidianIconFolderPlugin_Data
} from "../../utils/ObsidianIconFolderPluginSignature";
import {
	MOCK_TIMESTAMP,
	mockTFile,
	mockTFolder,
	mockTFolderWithChildren
} from "../mocks";

const MockedLoc: Pos = {
	start: {col:0,offset:0,line:0},
	end: {col:0,offset:0,line:0}
}

describe('determineSortingGroup', () => {
	describe('CustomSortGroupType.ExactHeadAndTail', () => {
		it('should correctly recognize head and tail', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					exactPrefix: 'Ref',
					exactSuffix: 'ces'
				}]
			}

			// when
			const result: FolderItemForSorting = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should not allow overlap of head and tail', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					exactPrefix: 'Referen',
					exactSuffix: 'rences'
				}]
			}

			// when
			const result: FolderItemForSorting = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx (no match)
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/References.md'
			});
		})
		it('should not allow overlap of head and tail, when simple regexp in head', () => {
			// given
			const file: TFile = mockTFile('Part123:-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					regexPrefix: {
						regex: /^Part\d\d\d:/i
					},
					exactSuffix: ':-icle'
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx (no match)
				isFolder: false,
				sortString: "Part123:-icle",
				sortStringWithExt: "Part123:-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part123:-icle.md'
			});
		})
		it('should not allow overlap of head and tail, when advanced regexp in head', () => {
			// given
			const file: TFile = mockTFile('Part123:-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					regexPrefix: {
						regex: /^Part *(\d+(?:-\d+)*):/i,
						normalizerFn: CompoundDashNumberNormalizerFn
					},
					exactSuffix: ':-icle'
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx
				isFolder: false,
				sortString: "Part123:-icle",
				sortStringWithExt: "Part123:-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part123:-icle.md'
			});
		})
		it('should match head and tail, when simple regexp in head', () => {
			// given
			const file: TFile = mockTFile('Part123:-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					regexPrefix: {
						regex: /^Part\d\d\d:/i,
						normalizerFn: CompoundDashNumberNormalizerFn
					},
					exactSuffix: '-icle'
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0, // Matched!
				isFolder: false,
				sortString: "Part123:-icle",
				sortStringWithExt: "Part123:-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part123:-icle.md'
			});
		})
		it('should match head and tail, when advanced regexp in head', () => {
			// given
			const file: TFile = mockTFile('Part123:-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					regexPrefix: {
						regex: /^Part *(\d+(?:-\d+)*):/i,
						normalizerFn: CompoundDashNumberNormalizerFn
					},
					exactSuffix: '-icle'
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0, // Matched!
				isFolder: false,
				sortString: "00000123////Part123:-icle",
				sortStringWithExt: "00000123////Part123:-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part123:-icle.md'
			});
		})
		it('should not allow overlap of head and tail, when regexp in tail', () => {
			// given
			const file: TFile = mockTFile('Part:123-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					exactPrefix: 'Part:',
					regexSuffix: {
						regex: /: *(\d+(?:-\d+)*)-icle$/i,
						normalizerFn: CompoundDashNumberNormalizerFn
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx
				isFolder: false,
				sortString: "Part:123-icle",
				sortStringWithExt: "Part:123-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part:123-icle.md'
			});
		});
		it('should match head and tail, when simple regexp in head and tail', () => {
			// given
			const file: TFile = mockTFile('Part:123-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					regexPrefix: {
						regex: /^Part:\d/i
					},
					regexSuffix: {
						regex: /\d-icle$/i
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0, // Matched!
				isFolder: false,
				sortString: "Part:123-icle",
				sortStringWithExt: "Part:123-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part:123-icle.md'
			});
		});
		it('should match head and tail, when simple regexp in head and and mixed in tail', () => {
			// given
			const file: TFile = mockTFile('Part:1 1-23.456-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					regexPrefix: {
						regex: /^Part:\d/i
					},
					regexSuffix: {
						regex: / *(\d+(?:-\d+)*).\d\d\d-icle$/i,
						normalizerFn: CompoundDashNumberNormalizerFn
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0, // Matched!
				isFolder: false,
				sortString: "00000001|00000023////Part:1 1-23.456-icle",
				sortStringWithExt: "00000001|00000023////Part:1 1-23.456-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part:1 1-23.456-icle.md'
			});
		});
		it('should match head and tail, when advanced regexp in tail', () => {
			// given
			const file: TFile = mockTFile('Part:123-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					exactPrefix: 'Part',
					regexSuffix: {
						regex: /: *(\d+(?:-\d+)*)-icle$/i,
						normalizerFn: CompoundDashNumberNormalizerFn
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0, // Matched!
				isFolder: false,
				sortString: "00000123////Part:123-icle",
				sortStringWithExt: "00000123////Part:123-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part:123-icle.md'
			});
		});
		it('should match head and tail, when advanced regexp in both, head and tail', () => {
			// given
			const file: TFile = mockTFile('Part 555-6 123-icle', 'md', 444, MOCK_TIMESTAMP + 555, MOCK_TIMESTAMP + 666);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['Some parent folder'],
				groups: [{
					type: CustomSortGroupType.ExactHeadAndTail,
					regexPrefix: {
						regex: /^Part *(\d+(?:-\d+)*)/i,
						normalizerFn: CompoundDashNumberNormalizerFn
					},
					regexSuffix: {
						regex: / *(\d+(?:-\d+)*)-icle$/i,
						normalizerFn: CompoundDashNumberNormalizerFn
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0, // Matched!
				isFolder: false,
				sortString: "00000555|00000006//00000123////Part 555-6 123-icle",
				sortStringWithExt: "00000555|00000006//00000123////Part 555-6 123-icle.md",
				ctime: MOCK_TIMESTAMP + 555,
				mtime: MOCK_TIMESTAMP + 666,
				path: 'Some parent folder/Part 555-6 123-icle.md'
			});
		});
	})
	describe('CustomSortGroupType.ExactPrefix', () => {
		it('should correctly recognize exact prefix', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref'
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should correctly recognize exact simple regex prefix', () => {
			// given
			const file: TFile = mockTFile('Ref2erences', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					regexPrefix: {
						regex: /Ref[0-9]/i
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "Ref2erences",
				sortStringWithExt: "Ref2erences.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/Ref2erences.md'
			});
		})
		it('should correctly recognize exact prefix, regexL variant', () => {
			// given
			const file: TFile = mockTFile('Reference i.xxx.vi.mcm', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					regexPrefix: {
						regex: /^Reference *([MDCLXVI]+(?:\.[MDCLXVI]+)*)/i,
						normalizerFn: CompoundDotRomanNumberNormalizerFn
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: '00000001|00000030|00000006|00001900////Reference i.xxx.vi.mcm',
				sortStringWithExt: '00000001|00000030|00000006|00001900////Reference i.xxx.vi.mcm.md',
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/Reference i.xxx.vi.mcm.md'
			});
		})
		it('should correctly process not matching prefix', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Pref'
				}]
			}
			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
	})
	describe('CustomSortGroupType.ExactSuffix', () => {
		it('should correctly recognize exact suffix', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactSuffix,
					exactSuffix: 'ces'
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should correctly recognize exact simple regex suffix', () => {
			// given
			const file: TFile = mockTFile('References 12', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactSuffix,
					regexSuffix: {
						regex: /ces [0-9][0-9]$/i
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References 12",
				sortStringWithExt: "References 12.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References 12.md'
			});
		})
		it('should correctly recognize exact suffix, regexL variant', () => {
			// given
			const file: TFile = mockTFile('Reference i.xxx.vi.mcm', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactSuffix,
					regexSuffix: {
						regex: /  *([MDCLXVI]+(?:\.[MDCLXVI]+)*)$/i,
						normalizerFn: CompoundDotRomanNumberNormalizerFn
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: '00000001|00000030|00000006|00001900////Reference i.xxx.vi.mcm',
				sortStringWithExt: '00000001|00000030|00000006|00001900////Reference i.xxx.vi.mcm.md',
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/Reference i.xxx.vi.mcm.md'
			});
		})
		it('should correctly process not matching suffix', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactSuffix,
					exactSuffix: 'ence'
				}]
			}
			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should correctly process not matching regex suffix', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactSuffix,
					regexSuffix: {
						regex: /ence$/i
					}
				}]
			}
			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
	})
	describe('CustomSortGroupType.ExactName', () => {
		it('should correctly recognize exact name', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactName,
					exactText: 'References'
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should correctly recognize exact simple regex-based name', () => {
			// given
			const file: TFile = mockTFile('References 12', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactName,
					regexPrefix: {
						regex: /^References [0-9][0-9]$/i
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References 12",
				sortStringWithExt: "References 12.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References 12.md'
			});
		})
		it('should correctly recognize exact name, regexL variant', () => {
			// given
			const file: TFile = mockTFile('Reference i.xxx.vi.mcm', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactName,
					regexPrefix: {
						regex: /^Reference  *([MDCLXVI]+(?:\.[MDCLXVI]+)*)$/i,
						normalizerFn: CompoundDotRomanNumberNormalizerFn
					}
				}]
			}

			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: '00000001|00000030|00000006|00001900////Reference i.xxx.vi.mcm',
				sortStringWithExt: '00000001|00000030|00000006|00001900////Reference i.xxx.vi.mcm.md',
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/Reference i.xxx.vi.mcm.md'
			});
		})
		it('should correctly process not matching name', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactName,
					exactText: 'ence'
				}]
			}
			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should correctly process not matching regex name', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactName,
					regexPrefix: {
						regex: /^Reference$/i
					}
				}]
			}
			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 1, // This indicates the last+1 idx
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should consume shadow group instead of group, if shadow is present', () => {
			// given
			const file: TFile = mockTFile('gs-123', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactName,
					exactText: 'g-123'
				}],
				groupsShadow: [{
					type: CustomSortGroupType.ExactName,
					exactText: 'gs-123'
				}]
			}
			// when
			const result = determineSortingGroup(file, sortSpec)

			// then
			expect(result).toEqual({
				groupIdx: 0, // This indicates match!
				isFolder: false,
				sortString: "gs-123",
				sortStringWithExt: "gs-123.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/gs-123.md'
			});
		})
	})
	describe('CustomSortGroupType.byMetadataFieldAlphabetical', () => {
		it('should ignore the file item if it has no direct metadata', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasMetadataField,
					withMetadataFieldName: "metadataField1",
					exactPrefix: 'Ref'
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							"References": {
								frontmatter: {
									metadataField1InvalidField: "directMetadataOnFile",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 1,  // The lastIdx+1, group not determined
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should ignore the folder item if it has no metadata on folder note', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasMetadataField,
					withMetadataFieldName: "metadataField1",
					exactPrefix: 'Ref'
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							"References": {
								frontmatter: {
									metadataField1: undefined,
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 1,  // lastIdx + 1, group not determined
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
		})
		it('should correctly include the File item if has direct metadata (group not sorted by metadata', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasMetadataField,
					withMetadataFieldName: "metadataField1",
					exactPrefix: 'Ref'
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadataField1": "directMetadataOnFile",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			} as FolderItemForSorting);
		})
		it('should correctly include the Folder item if it has folder note metadata (group not sorted by metadata', () => {
			// given
			const folder: TFolder = mockTFolder('References');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasMetadataField,
					withMetadataFieldName: "metadataField1",
					exactPrefix: 'Ref'
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'References/References.md': {
								frontmatter: {
									"metadataField1": "directMetadataOnFile",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: true,
				sortString: "References",
				sortStringWithExt: "References",
				ctime: DEFAULT_FOLDER_CTIME,
				mtime: DEFAULT_FOLDER_MTIME,
				path: 'References',
				folder: folder
			} as FolderItemForSorting);
		})
	})
	describe('CustomSortGroupType.BookmarkedOnly', () => {
		it('should not match not bookmarked file', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.BookmarkedOnly
				}]
			}
			const bookmarksPluginInstance: Partial<BookmarksPluginInterface> = {
				determineBookmarkOrder: jest.fn( function(path: string): number | undefined {
					return undefined
				})
			}

			// when
			const result = determineSortingGroup(file, sortSpec, {
				bookmarksPluginInstance: bookmarksPluginInstance as BookmarksPluginInterface
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 1,  // The lastIdx+1, group not determined
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
			expect(bookmarksPluginInstance.determineBookmarkOrder).toHaveBeenCalledTimes(1)
		})
		it('should match bookmarked file', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.BookmarkedOnly
				}]
			}
			const BOOKMARK_ORDER = 123
			const bookmarksPluginInstance: Partial<BookmarksPluginInterface> = {
				determineBookmarkOrder: jest.fn( function(path: string): number | undefined {
					return path === 'Some parent folder/References.md' ? BOOKMARK_ORDER : undefined
				})
			}

			// when
			const result = determineSortingGroup(file, sortSpec, {
				bookmarksPluginInstance: bookmarksPluginInstance as BookmarksPluginInterface
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				bookmarkedIdx: BOOKMARK_ORDER,
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
			expect(bookmarksPluginInstance.determineBookmarkOrder).toHaveBeenCalledTimes(1)
		})
	})
	describe('CustomSortGroupType.HasIcon', () => {
		it('should not match file w/o icon', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {settings: {}}  // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
				})
			}

			// when
			const result = determineSortingGroup(file, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 1,  // The lastIdx+1, group not determined
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should not match file with icon of different name', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon,
					iconName: 'IncorrectIconName'
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'Some parent folder/References.md': 'CorrectIconName'
					}
				})
			}

			// when
			const result = determineSortingGroup(file, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 1,  // The lastIdx+1, group not determined
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should match file with any icon', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'Some parent folder/References.md': 'Irrelevant icon name, only presence matters'
					}
				})
			}

			// when
			const result = determineSortingGroup(file, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should match file with icon of expected name', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon,
					iconName: 'CorrectIconName'
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'Some parent folder/References.md': 'CorrectIconName'
					}
				})
			}

			// when
			const result = determineSortingGroup(file, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md'
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should not match folder w/o icon', () => {
			// given
			const folder: TFolder = mockTFolder('TestEmptyFolder');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {settings: {}}  // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
				})
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 1,  // The lastIdx+1, group not determined
				isFolder: true,
				sortString: "TestEmptyFolder",
				sortStringWithExt: "TestEmptyFolder",

				ctime: 0,
				mtime: 0,
				path: 'TestEmptyFolder',
				folder: {
					children: [],
					isRoot: expect.any(Function),
					name: "TestEmptyFolder",
					parent: {},
					path: "TestEmptyFolder",
					vault: {}
				}
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should match folder with any icon (icon specified by string alone)', () => {
			// given
			const folder: TFolder = mockTFolderWithChildren('TestEmptyFolder');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'TestEmptyFolder': 'Irrelevant icon name, only presence matters'
					}
				})
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: true,
				sortString: "TestEmptyFolder",
				sortStringWithExt: "TestEmptyFolder",

				ctime: 0,
				mtime: 0,
				path: 'TestEmptyFolder',
				folder: {
					children: expect.any(Array),
					isRoot: expect.any(Function),
					name: "TestEmptyFolder",
					parent: {},
					path: "TestEmptyFolder",
					vault: {}
				}
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should match folder with any icon (icon specified together with inheritance)', () => {
			// given
			const folder: TFolder = mockTFolderWithChildren('TestEmptyFolder');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'TestEmptyFolder': {
							iconName: 'ConfiguredIcon',
							inheritanceIcon: 'ConfiguredInheritanceIcon'
						}
					}
				})
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: true,
				sortString: "TestEmptyFolder",
				sortStringWithExt: "TestEmptyFolder",

				ctime: 0,
				mtime: 0,
				path: 'TestEmptyFolder',
				folder: {
					children: expect.any(Array),
					isRoot: expect.any(Function),
					name: "TestEmptyFolder",
					parent: {},
					path: "TestEmptyFolder",
					vault: {}
				}
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should match folder with specified icon (icon specified by string alone)', () => {
			// given
			const folder: TFolder = mockTFolderWithChildren('TestEmptyFolder');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon,
					iconName: 'ConfiguredIcon-by-string'
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'TestEmptyFolder': 'ConfiguredIcon-by-string'
					}
				})
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: true,
				sortString: "TestEmptyFolder",
				sortStringWithExt: "TestEmptyFolder",

				ctime: 0,
				mtime: 0,
				path: 'TestEmptyFolder',
				folder: {
					children: expect.any(Array),
					isRoot: expect.any(Function),
					name: "TestEmptyFolder",
					parent: {},
					path: "TestEmptyFolder",
					vault: {}
				}
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should match folder with specified icon (icon specified together with inheritance)', () => {
			// given
			const folder: TFolder = mockTFolderWithChildren('TestEmptyFolder');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon,
					iconName: 'ConfiguredIcon'
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'TestEmptyFolder': {
							iconName: 'ConfiguredIcon',
							inheritanceIcon: 'ConfiguredInheritanceIcon'
						}
					}
				})
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: true,
				sortString: "TestEmptyFolder",
				sortStringWithExt: "TestEmptyFolder",

				ctime: 0,
				mtime: 0,
				path: 'TestEmptyFolder',
				folder: {
					children: expect.any(Array),
					isRoot: expect.any(Function),
					name: "TestEmptyFolder",
					parent: {},
					path: "TestEmptyFolder",
					vault: {}
				}
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should not match folder with different icon (icon specified by string alone)', () => {
			// given
			const folder: TFolder = mockTFolderWithChildren('TestEmptyFolder');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon,
					iconName: 'ConfiguredIcon-by-string'
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'TestEmptyFolder': 'AnotherConfiguredIcon-by-string'
					}
				})
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 1, // lastIdx+1 - no match
				isFolder: true,
				sortString: "TestEmptyFolder",
				sortStringWithExt: "TestEmptyFolder",
				ctime: 0,
				mtime: 0,
				path: 'TestEmptyFolder',
				folder: {
					children: expect.any(Array),
					isRoot: expect.any(Function),
					name: "TestEmptyFolder",
					parent: {},
					path: "TestEmptyFolder",
					vault: {}
				}
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
		it('should not match folder with different icon (icon specified together with inheritance)', () => {
			// given
			const folder: TFolder = mockTFolderWithChildren('TestEmptyFolder');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasIcon,
					iconName: 'ConfiguredIcon'
				}]
			}
			const obsidianIconFolderPluginInstance: Partial<ObsidianIconFolder_PluginInstance> = {
				getData: jest.fn( function(): ObsidianIconFolderPlugin_Data {
					return {
						settings: {}, // The obsidian-folder-icon plugin keeps the settings there indeed ;-)
						'TestEmptyFolder': {
							iconName: 'OtherConfiguredIcon',
							inheritanceIcon: 'ConfiguredInheritanceIcon'
						}
					}
				})
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, {
				iconFolderPluginInstance: obsidianIconFolderPluginInstance as ObsidianIconFolder_PluginInstance
			} as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 1,  // lastIdx+1 - no match
				isFolder: true,
				sortString: "TestEmptyFolder",
				sortStringWithExt: "TestEmptyFolder",
				ctime: 0,
				mtime: 0,
				path: 'TestEmptyFolder',
				folder: {
					children: expect.any(Array),
					isRoot: expect.any(Function),
					name: "TestEmptyFolder",
					parent: {},
					path: "TestEmptyFolder",
					vault: {}
				}
			});
			expect(obsidianIconFolderPluginInstance.getData).toHaveBeenCalledTimes(1)
		})
	})
	describe('when sort by metadata is involved', () => {
		it('should correctly read direct metadata from File item (order by metadata set on group) alph', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldAlphabetical,
						byMetadata: 'metadata-field-for-sorting',
					},
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting": "direct metadata on file",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValue: 'direct metadata on file'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group) alph rev', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldAlphabeticalReverse,
						byMetadata: 'metadata-field-for-sorting',},
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting": "direct metadata on file",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValue: 'direct metadata on file'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group) true alph', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldTrueAlphabetical,
						byMetadata: 'metadata-field-for-sorting', },
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting": "direct metadata on file",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValue: 'direct metadata on file'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group) true alph rev', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldTrueAlphabeticalReverse,
						byMetadata: 'metadata-field-for-sorting', },
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting": "direct metadata on file",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValue: 'direct metadata on file'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from folder note item (order by metadata set on group)', () => {
			// given
			const folder: TFolder = mockTFolder('References');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldAlphabeticalReverse,
						byMetadata: 'metadata-field-for-sorting', },
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'References/References.md': {
								frontmatter: {
									'metadata-field-for-sorting': "metadata on folder note",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: true,
				sortString: "References",
				sortStringWithExt: "References",
				ctime: DEFAULT_FOLDER_CTIME,
				mtime: DEFAULT_FOLDER_MTIME,
				path: 'References',
				metadataFieldValue: 'metadata on folder note',
				folder: folder
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on target folder)', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldAlphabetical },
				}],
				defaultSorting: { order: CustomSortOrder.byMetadataFieldAlphabeticalReverse,
					byMetadata: 'metadata-field-for-sorting-specified-on-target-folder'
				}
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting-specified-on-target-folder": "direct metadata on file, not obvious",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValueForDerived: 'direct metadata on file, not obvious'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group, no metadata name specified on group)', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasMetadataField,
					sorting: { order: CustomSortOrder.byMetadataFieldAlphabetical, },
					withMetadataFieldName: 'field-used-with-with-metadata-syntax'
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									'field-used-with-with-metadata-syntax': "direct metadata on file, tricky",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValue: 'direct metadata on file, tricky'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group, no metadata name specified anywhere)', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldAlphabetical },
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									'sort-index-value': "direct metadata on file, under default name",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValue: 'direct metadata on file, under default name'
			} as FolderItemForSorting);
		})
	})

	describe('when sort by metadata is involved (specified in secondary sort, for group of for target folder)', () => {
		it('should correctly read direct metadata from File item (order by metadata set on group) alph', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.alphabetical, },
					secondarySorting: { order: CustomSortOrder.byMetadataFieldAlphabetical,
						byMetadata: 'metadata-field-for-sorting', },
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting": "direct metadata on file",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValueSecondary: 'direct metadata on file'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group) alph rev', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.alphabeticalReverse, },
					secondarySorting: { order: CustomSortOrder.byMetadataFieldAlphabeticalReverse,
						byMetadata: 'metadata-field-for-sorting', },
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting": "direct metadata on file",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValueSecondary: 'direct metadata on file'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group) true alph', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldTrueAlphabetical,
						byMetadata: 'non-existing-mdata'},
					secondarySorting: { order: CustomSortOrder.byMetadataFieldTrueAlphabetical,
						byMetadata: 'metadata-field-for-sorting'},
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting": "direct metadata on file",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValueSecondary: 'direct metadata on file'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group) true alph rev (dbl mdata)', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldTrueAlphabetical,
						byMetadata: 'metadata-field-for-sorting',
					},
					secondarySorting: { order: CustomSortOrder.byMetadataFieldTrueAlphabeticalReverse,
						byMetadata: 'metadata-field-for-sorting secondary',
					},
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting": "direct metadata on file",
									"metadata-field-for-sorting secondary": "direct another metadata on file",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValue: 'direct metadata on file',
				metadataFieldValueSecondary: 'direct another metadata on file'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from folder note item (order by metadata set on group)', () => {
			// given
			const folder: TFolder = mockTFolder('References');
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.standardObsidian },
					secondarySorting: { order: CustomSortOrder.byMetadataFieldAlphabeticalReverse,
						byMetadata: 'metadata-field-for-sorting'
					},
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'References/References.md': {
								frontmatter: {
									'metadata-field-for-sorting': "metadata on folder note",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(folder, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: true,
				sortString: "References",
				sortStringWithExt: "References",
				ctime: DEFAULT_FOLDER_CTIME,
				mtime: DEFAULT_FOLDER_MTIME,
				path: 'References',
				metadataFieldValueSecondary: 'metadata on folder note',
				folder: folder
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on target folder)', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.trueAlphabetical, },
					secondarySorting: { order: CustomSortOrder.byMetadataFieldAlphabetical },
				}],
				defaultSorting: { order: CustomSortOrder.byCreatedTime, },
				defaultSecondarySorting: { order: CustomSortOrder.byMetadataFieldAlphabeticalReverse,
					byMetadata: 'metadata-field-for-sorting-specified-on-target-folder'
				},
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									"metadata-field-for-sorting-specified-on-target-folder": "direct metadata on file, not obvious",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValueForDerivedSecondary: 'direct metadata on file, not obvious'
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group, no metadata name specified on group)', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.HasMetadataField,
					sorting: { order: CustomSortOrder.standardObsidian, },
					secondarySorting: { order: CustomSortOrder.byMetadataFieldAlphabetical, },
					withMetadataFieldName: 'field-used-with-with-metadata-syntax'
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									'field-used-with-with-metadata-syntax': "direct metadata on file, tricky",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValueSecondary: 'direct metadata on file, tricky',
			} as FolderItemForSorting);
		})
		it('should correctly read direct metadata from File item (order by metadata set on group, no metadata name specified anywhere)', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byCreatedTimeReverse, },
					secondarySorting: { order: CustomSortOrder.byMetadataFieldAlphabetical },
				}]
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									'sort-index-value': "direct metadata on file, under default name",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValueSecondary: 'direct metadata on file, under default name',
			} as FolderItemForSorting);
		})
	})

	describe('when sort by metadata is involved, at every level', () => {
		it('should correctly read direct metadata from File item (order by metadata set at each level)', () => {
			// given
			const file: TFile = mockTFile('References', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
			const sortSpec: CustomSortSpec = {
				targetFoldersPaths: ['/'],
				groups: [{
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: 'Ref',
					sorting: { order: CustomSortOrder.byMetadataFieldAlphabetical,
						byMetadata: 'mdata-for-primary',
					},
					secondarySorting: { order: CustomSortOrder.byMetadataFieldAlphabeticalReverse,
						byMetadata: 'mdata-for-secondary'
					},
				}],
				defaultSorting: { order: CustomSortOrder.byMetadataFieldTrueAlphabetical,
					byMetadata: 'mdata-for-default-primary',
				},
				defaultSecondarySorting: { order: CustomSortOrder.byMetadataFieldTrueAlphabeticalReverse,
					byMetadata: 'mdata-for-default-secondary'
				},
			}
			const ctx: Partial<ProcessingContext> = {
				_mCache: {
					getCache: function (path: string): CachedMetadata | undefined {
						return {
							'Some parent folder/References.md': {
								frontmatter: {
									'mdata-for-primary': "filemdata 1",
									'mdata-for-secondary': "filemdata 2",
									'mdata-for-default-primary': "filemdata 3",
									'mdata-for-default-secondary': "filemdata 4",
									position: MockedLoc
								}
							}
						}[path]
					}
				} as MetadataCache
			}

			// when
			const result = determineSortingGroup(file, sortSpec, ctx as ProcessingContext)

			// then
			expect(result).toEqual({
				groupIdx: 0,
				isFolder: false,
				sortString: "References",
				sortStringWithExt: "References.md",
				ctime: MOCK_TIMESTAMP + 222,
				mtime: MOCK_TIMESTAMP + 333,
				path: 'Some parent folder/References.md',
				metadataFieldValue: 'filemdata 1',
				metadataFieldValueSecondary: 'filemdata 2',
				metadataFieldValueForDerived: 'filemdata 3',
				metadataFieldValueForDerivedSecondary: 'filemdata 4',
			} as FolderItemForSorting);
		})
	})

	it('should correctly apply priority group', () => {
		// given
		const file: TFile = mockTFile('Abcdef!', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
		const sortSpec: CustomSortSpec = {
			groups: [{
				filesOnly: true,
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.MatchAll
			}, {
				foldersOnly: true,
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.MatchAll
			}, {
				exactSuffix: "def!",
				priority: 2,
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.ExactSuffix
			}, {
				exactText: "Abcdef!",
				sorting: { order: CustomSortOrder.alphabetical, },
				priority: 3,
				type: CustomSortGroupType.ExactName
			}, {
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.Outsiders
			}],
			outsidersGroupIdx: 4,
			targetFoldersPaths: ['/'],
			priorityOrder: [3,2,0,1]
		}

		// when
		const result = determineSortingGroup(file, sortSpec)

		// then
		expect(result).toEqual({
			groupIdx: 3,
			isFolder: false,
			sortString: "Abcdef!",
				sortStringWithExt: "Abcdef!.md",
			ctime: MOCK_TIMESTAMP + 222,
			mtime: MOCK_TIMESTAMP + 333,
			path: 'Some parent folder/Abcdef!.md'
		});
	})
	it('should correctly recognize and apply combined group', () => {
		// given
		const file1: TFile = mockTFile('Hello :-) ha', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
		const file2: TFile = mockTFile('Hello World :-)', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
		const sortSpec: CustomSortSpec = {
			groups: [{
				exactSuffix: "def!",
				sorting: { order: CustomSortOrder.alphabeticalReverse, },
				type: CustomSortGroupType.ExactSuffix
			}, {
				exactPrefix: "Hello :-)",
				sorting: { order: CustomSortOrder.alphabeticalReverse, },
				type: CustomSortGroupType.ExactPrefix,
				combineWithIdx: 1
			}, {
				exactText: "Hello World :-)",
				sorting: { order: CustomSortOrder.alphabeticalReverse, },
				type: CustomSortGroupType.ExactName,
				combineWithIdx: 1
			}, {
				filesOnly: true,
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.MatchAll
			}, {
				foldersOnly: true,
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.MatchAll
			}, {
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.Outsiders
			}],
			outsidersGroupIdx: 5,
			targetFoldersPaths: ['/']
		}

		// when
		const result1 = determineSortingGroup(file1, sortSpec)
		const result2 = determineSortingGroup(file2, sortSpec)

		// then
		expect(result1).toEqual({
			groupIdx: 1, // Imposed by combined groups
			isFolder: false,
			sortString: "Hello :-) ha",
				sortStringWithExt: "Hello :-) ha.md",
			ctime: MOCK_TIMESTAMP + 222,
			mtime: MOCK_TIMESTAMP + 333,
			path: 'Some parent folder/Hello :-) ha.md'
		});
		expect(result2).toEqual({
			groupIdx: 1, // Imposed by combined groups
			isFolder: false,
			sortString: "Hello World :-)",
				sortStringWithExt: "Hello World :-).md",
			ctime: MOCK_TIMESTAMP + 222,
			mtime: MOCK_TIMESTAMP + 333,
			path: 'Some parent folder/Hello World :-).md'
		});
	})
	it('should correctly recognize and apply combined group in connection with priorities', () => {
		// given
		const file: TFile = mockTFile('Hello :-)', 'md', 111, MOCK_TIMESTAMP + 222, MOCK_TIMESTAMP + 333);
		const sortSpec: CustomSortSpec = {
			groups: [{
				filesOnly: true,
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.MatchAll
			}, {
				foldersOnly: true,
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.MatchAll
			}, {
				exactSuffix: "def!",
				sorting: { order: CustomSortOrder.alphabeticalReverse, },
				type: CustomSortGroupType.ExactSuffix,
				combineWithIdx: 2
			}, {
				exactText: "Hello :-)",
				sorting: { order: CustomSortOrder.alphabeticalReverse, },
				type: CustomSortGroupType.ExactName,
				priority: 1,
				combineWithIdx: 2
			}, {
				sorting: { order: CustomSortOrder.alphabetical, },
				type: CustomSortGroupType.Outsiders
			}],
			outsidersGroupIdx: 4,
			priorityOrder: [3,0,1,2],
			targetFoldersPaths: ['/']
		}

		// when
		const result = determineSortingGroup(file, sortSpec)

		// then
		expect(result).toEqual({
			groupIdx: 2, // Imposed by combined groups
 			isFolder: false,
			sortString: "Hello :-)",
				sortStringWithExt: "Hello :-).md",
			ctime: MOCK_TIMESTAMP + 222,
			mtime: MOCK_TIMESTAMP + 333,
			path: 'Some parent folder/Hello :-).md'
		});
	})
})

describe('matchGroupRegex', () => {
	it( 'should correctly handle no match', () => {
		// given
		const regExpSpec: RegExpSpec = {
			regex: /a(b)c/i
		}
		const name: string = 'Abbc'

		// when
		const [matched, matchedGroup, entireMatch] = matchGroupRegex(regExpSpec, name)

		// then
		expect(matched).toBe(false)
		expect(matchedGroup).toBeUndefined()
		expect(entireMatch).toBeUndefined()
	})
	it('should correctly handle no matching group match and normalizer absent', () => {
		// given
		const regExpSpec: RegExpSpec = {
			regex: /ab+c/i
		}
		const name: string = 'Abbbc'

		// when
		const [matched, matchedGroup, entireMatch] = matchGroupRegex(regExpSpec, name)

		// then
		expect(matched).toBe(true)
		expect(matchedGroup).toBeUndefined()
		expect(entireMatch).toBe('Abbbc')
	})
	it('should correctly handle no matching group match and normalizer present', () => {
		// given
		const regExpSpec: RegExpSpec = {
			regex: /ab+c/i,
			normalizerFn: jest.fn()
		}
		const name: string = 'Abc'

		// when
		const [matched, matchedGroup, entireMatch] = matchGroupRegex(regExpSpec, name)

		// then
		expect(matched).toBe(true)
		expect(matchedGroup).toBeUndefined()
		expect(entireMatch).toBe('Abc')
		expect(regExpSpec.normalizerFn).not.toHaveBeenCalled()
	})
	it('should correctly handle matching group match and normalizer absent', () => {
		// given
		const regExpSpec: RegExpSpec = {
			regex: /a(b+)c/i
		}
		const name: string = 'Abbbc'

		// when
		const [matched, matchedGroup, entireMatch] = matchGroupRegex(regExpSpec, name)

		// then
		expect(matched).toBe(true)
		expect(matchedGroup).toBe('bbb')
		expect(entireMatch).toBe('Abbbc')
	})
	it('should correctly handle matching group match and normalizer present', () => {
		// given
		const regExpSpec: RegExpSpec = {
			regex: /a(b+)c/i,
			normalizerFn: jest.fn((s) => `>>${s}<<`)
		}
		const name: string = 'Abc'

		// when
		const [matched, matchedGroup, entireMatch] = matchGroupRegex(regExpSpec, name)

		// then
		expect(matched).toBe(true)
		expect(matchedGroup).toBe('>>b<<')
		expect(entireMatch).toBe('Abc')
		expect(regExpSpec.normalizerFn).toHaveBeenCalledTimes(1)
	})
})

const SORT_FIRST_GOES_EARLIER: number = -1
const SORT_FIRST_GOES_LATER: number = 1
const SORT_ITEMS_ARE_EQUAL: number = 0

describe('CustomSortOrder.byMetadataFieldAlphabetical', () => {
	it('should correctly order alphabetically when metadata on both items is present', () => {
		// given
		const itemA: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'A'
		}
		const itemB: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'B'
		}
		const sorter: SorterFn = getSorterFnFor(CustomSortOrder.byMetadataFieldAlphabetical)

		// when
		const result1: number = sorter(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
		const result2: number = sorter(itemB as FolderItemForSorting, itemA as FolderItemForSorting)

		// then
		expect(result1).toBe(SORT_FIRST_GOES_EARLIER)
		expect(result2).toBe(SORT_FIRST_GOES_LATER)
	})
	it('should correctly compare when metadata on both items is present and equal', () => {
		// given
		const itemA: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'Aaa',
			sortString: 'n123'
		}
		const itemB: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'Aaa',
			sortString: 'a123'
		}
		const sorter: SorterFn = getSorterFnFor(CustomSortOrder.byMetadataFieldAlphabetical)

		// when
		const result1: number = sorter(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
		const result2: number = sorter(itemB as FolderItemForSorting, itemA as FolderItemForSorting)
		const result3: number = sorter(itemB as FolderItemForSorting, itemB as FolderItemForSorting)

		// then
		expect(result1).toBe(EQUAL_OR_UNCOMPARABLE)
		expect(result2).toBe(EQUAL_OR_UNCOMPARABLE)
		expect(result3).toBe(EQUAL_OR_UNCOMPARABLE)
	})
	it('should put the item with metadata earlier if the second one has no metadata ', () => {
		// given
		const itemA: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'n159',
			sortString: 'n123'
		}
		const itemB: Partial<FolderItemForSorting> = {
			sortString: 'n123'
		}
		const sorter: SorterFn = getSorterFnFor(CustomSortOrder.byMetadataFieldAlphabetical)

		// when
		const result1: number = sorter(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
		const result2: number = sorter(itemB as FolderItemForSorting, itemA as FolderItemForSorting)

		// then
		expect(result1).toBe(SORT_FIRST_GOES_EARLIER)
		expect(result2).toBe(SORT_FIRST_GOES_LATER)
	})
	it('should refuse comparison if no metadata on both items', () => {
		// given
		const itemA: Partial<FolderItemForSorting> = {
			sortString: 'ccc'
		}
		const itemB: Partial<FolderItemForSorting> = {
			sortString: 'ccc '
		}
		const sorter: SorterFn = getSorterFnFor(CustomSortOrder.byMetadataFieldAlphabetical)

		// when
		const result1: number = sorter(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
		const result2: number = sorter(itemB as FolderItemForSorting, itemA as FolderItemForSorting)
		const result3: number = sorter(itemB as FolderItemForSorting, itemB as FolderItemForSorting)

		// then
		expect(result1).toBe(EQUAL_OR_UNCOMPARABLE)
		expect(result2).toBe(EQUAL_OR_UNCOMPARABLE)
		expect(result3).toBe(EQUAL_OR_UNCOMPARABLE)
	})
})

describe('CustomSortOrder.byMetadataFieldAlphabeticalReverse', () => {
	it('should correctly order alphabetically reverse when metadata on both items is present', () => {
		// given
		const itemA: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'A'
		}
		const itemB: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'B'
		}
		const sorter: SorterFn = getSorterFnFor(CustomSortOrder.byMetadataFieldAlphabeticalReverse)

		// when
		const result1: number = sorter(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
		const result2: number = sorter(itemB as FolderItemForSorting, itemA as FolderItemForSorting)

		// then
		expect(result1).toBe(SORT_FIRST_GOES_LATER)
		expect(result2).toBe(SORT_FIRST_GOES_EARLIER)
	})
	it('should correctly compare when metadata on both items is present and equal', () => {
		// given
		const itemA: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'Aaa',
			sortString: 'n123'
		}
		const itemB: Partial<FolderItemForSorting> = {
			metadataFieldValue: 'Aaa',
			sortString: 'a123'
		}
		const sorter: SorterFn = getSorterFnFor(CustomSortOrder.byMetadataFieldAlphabeticalReverse)

		// when
		const result1: number = sorter(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
		const result2: number = sorter(itemB as FolderItemForSorting, itemA as FolderItemForSorting)
		const result3: number = sorter(itemB as FolderItemForSorting, itemB as FolderItemForSorting)

		// then
		expect(result1).toBe(EQUAL_OR_UNCOMPARABLE)
		expect(result2).toBe(EQUAL_OR_UNCOMPARABLE)
		expect(result3).toBe(EQUAL_OR_UNCOMPARABLE)
	})
	it('should put the item with metadata earlier if the second one has no metadata (reverse order)', () => {
		// given
		const itemA: Partial<FolderItemForSorting> = {
			metadataFieldValue: '15',
			sortString: 'n123'
		}
		const itemB: Partial<FolderItemForSorting> = {
			sortString: 'n123'
		}
		const sorter: SorterFn = getSorterFnFor(CustomSortOrder.byMetadataFieldAlphabeticalReverse)

		// when
		const result1: number = sorter(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
		const result2: number = sorter(itemB as FolderItemForSorting, itemA as FolderItemForSorting)

		// then
		expect(result1).toBe(SORT_FIRST_GOES_EARLIER)
		expect(result2).toBe(SORT_FIRST_GOES_LATER)
	})
	it('should refrain from comparing if no metadata on both items', () => {
		// given
		const itemA: Partial<FolderItemForSorting> = {
			sortString: 'ccc'
		}
		const itemB: Partial<FolderItemForSorting> = {
			sortString: 'ccc '
		}
		const sorter: SorterFn = getSorterFnFor(CustomSortOrder.byMetadataFieldAlphabeticalReverse)

		// when
		const result1: number = sorter(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
		const result2: number = sorter(itemB as FolderItemForSorting, itemA as FolderItemForSorting)
		const result3: number = sorter(itemB as FolderItemForSorting, itemB as FolderItemForSorting)

		// then
		expect(result1).toBe(EQUAL_OR_UNCOMPARABLE)
		expect(result2).toBe(EQUAL_OR_UNCOMPARABLE)
		expect(result3).toBe(EQUAL_OR_UNCOMPARABLE)
	})
})

describe('sorterByMetadataField - string metadata', () => {
	it.each([
		[true,'abc','def',-1, 'a', 'a'],
		[true,'xyz','klm',1, 'b', 'b'],
		[true,'mmm','mmm',EQUAL_OR_UNCOMPARABLE, 'c', 'c'],
		[true,'mmm','mmm',EQUAL_OR_UNCOMPARABLE, 'd', 'e'],
		[true,'mmm','mmm',EQUAL_OR_UNCOMPARABLE, 'e', 'd'],
		[true,'abc',undefined,-1, 'a','a'],
		[true,undefined,'klm',1, 'b','b'],
		[true,undefined,undefined,EQUAL_OR_UNCOMPARABLE, 'a','a'],
		[true,undefined,undefined,EQUAL_OR_UNCOMPARABLE, 'a','b'],
		[true,undefined,undefined,EQUAL_OR_UNCOMPARABLE, 'd','c'],
		[false,'abc','def',1, 'a', 'a'],
		[false,'xyz','klm',-1, 'b', 'b'],
		[false,'mmm','mmm',EQUAL_OR_UNCOMPARABLE, 'c', 'c'],
		[false,'mmm','mmm',EQUAL_OR_UNCOMPARABLE, 'd', 'e'],
		[false,'mmm','mmm',EQUAL_OR_UNCOMPARABLE, 'e', 'd'],
		[false,'abc',undefined,-1, 'a','a'],
		[false,undefined,'klm',1, 'b','b'],
		[false,undefined,undefined,EQUAL_OR_UNCOMPARABLE, 'a','a'],
		[false,undefined,undefined,EQUAL_OR_UNCOMPARABLE, 'a','b'],
		[false,undefined,undefined,EQUAL_OR_UNCOMPARABLE, 'd','c'],

	])('straight order %s, comparing %s and %s should return %s for sortStrings %s and %s',
		(straight: boolean, metadataA: string|undefined, metadataB: string|undefined, order: number, sortStringA: string, sortStringB) => {
		const sorterFn = sorterByMetadataField(!straight, false)
		const itemA: Partial<FolderItemForSorting> = {metadataFieldValue: metadataA, sortString: sortStringA}
		const itemB: Partial<FolderItemForSorting> = {metadataFieldValue: metadataB, sortString: sortStringB}
		const result = sorterFn(itemA as FolderItemForSorting, itemB as FolderItemForSorting)

		// then
		expect(result).toBe(order)
	})
})

describe('sorterByMetadataField - boolean metadata', () => {
	const ASC = true
	const DESC = false
	it.each([
		[ASC,true,false,1, 'a', 'a'],
		[ASC,false,true,-1, 'a', 'a'],
		[DESC,true,false,-1, 'a', 'a'],
		[DESC,false,true,1, 'a', 'a'],
		[ASC,true,undefined,-1, 'a', 'a'],
		[ASC,false,undefined,-1, 'a', 'a'],
		[DESC,true,undefined,-1, 'a', 'a'],
		[DESC,false,undefined,-1, 'a', 'a'],
		[ASC,undefined,true,1, 'a', 'a'],
		[ASC,undefined,false,1, 'a', 'a'],
		[DESC,undefined,true,1, 'a', 'a'],
		[DESC,undefined,false,1, 'a', 'a'],
		[ASC,true,true,EQUAL_OR_UNCOMPARABLE, 'a', 'b'],
		[ASC,false,false,EQUAL_OR_UNCOMPARABLE, 'a', 'b'],
		[DESC,true,true,EQUAL_OR_UNCOMPARABLE, 'a', 'b'],
		[DESC,false,false,EQUAL_OR_UNCOMPARABLE, 'a', 'b'],
		[ASC,true,'false',1, 'a', 'a'],
		[ASC,'false',true,-1, 'a', 'a'],
		[DESC,true,'false',-1, 'a', 'a'],
		[DESC,'false',true,1, 'a', 'a'],
		[ASC,'true',false,1, 'a', 'a'],
		[ASC,false,'true',-1, 'a', 'a'],
		[DESC,'true',false,-1, 'a', 'a'],
		[DESC,false,'true',1, 'a', 'a'],
		[ASC,true,'true',EQUAL_OR_UNCOMPARABLE, 'a', 'b'],
		[ASC,'false',false,EQUAL_OR_UNCOMPARABLE, 'a', 'b'],
		[DESC,'true',true,EQUAL_OR_UNCOMPARABLE, 'a', 'b'],
		[DESC,false,'false',EQUAL_OR_UNCOMPARABLE, 'a', 'b'],

	])('straight order %s, comparing %s and %s should return %s for sortStrings %s and %s',
		(straight: boolean, metadataA: boolean|string|undefined, metadataB: boolean|string|undefined, order: number, sortStringA: string, sortStringB) => {
			const sorterFn = sorterByMetadataField(!straight, false)
			const itemA: Partial<FolderItemForSorting> = {metadataFieldValue: metadataA as any, sortString: sortStringA}
			const itemB: Partial<FolderItemForSorting> = {metadataFieldValue: metadataB as any, sortString: sortStringB}
			const result = sorterFn(itemA as FolderItemForSorting, itemB as FolderItemForSorting)

			// then
			expect(result).toBe(order)
		})
})

describe('sorterByBookmarkOrder', () => {
	it.each([
		[true,10,20,-1, 'a', 'a'],
		[true,20,10,1, 'b', 'b'],
		[true,30,30,0, 'c', 'c'],   // not possible in reality - each bookmark order is unique by definition - covered for clarity
		[true,1,1,0, 'd', 'e'],     //     ----//----
		[true,2,2,0, 'e', 'd'],     //     ----//----
		[true,3,undefined,-1, 'a','a'],
		[true,undefined,4,1, 'b','b'],
		[true,undefined,undefined,0, 'a','a'],
		[true,undefined,undefined,0, 'a','b'],
		[true,undefined,undefined,0, 'd','c'],
		[false,10,20,1, 'a', 'a'],
		[false,20,10,-1, 'b', 'b'],
		[false,30,30,0, 'c', 'c'],    // not possible in reality - each bookmark order is unique by definition - covered for clarity
		[false,1,1,0, 'd', 'e'],      //    ------//-----
		[false,2,2,0, 'e', 'd'],     //    ------//-----
		[false,3,undefined,-1, 'a','a'],
		[false,undefined,4,1, 'b','b'],
		[false,undefined,undefined,0, 'a','a'],
		[false,undefined,undefined,0, 'a','b'],
		[false,undefined,undefined,0, 'd','c'],

	])('straight order %s, comparing %s and %s should return %s for sortStrings %s and %s',
		(straight: boolean, bookmarkA: number|undefined, bookmarkB: number|undefined, order: number, sortStringA: string, sortStringB) => {
			const sorterFn = sorterByBookmarkOrder(!straight, false)
			const itemA: Partial<FolderItemForSorting> = {bookmarkedIdx: bookmarkA, sortString: sortStringA}
			const itemB: Partial<FolderItemForSorting> = {bookmarkedIdx: bookmarkB, sortString: sortStringB}
			const result = sorterFn(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
			const normalizedResult = result < 0 ? -1 : ((result > 0) ? 1 : result)

			// then
			expect(normalizedResult).toBe(order)
		})
})

const OLDER_TIME: number = 1000000
const NEWER_TIME: number = OLDER_TIME + 1000
const EOU: number =  EQUAL_OR_UNCOMPARABLE

describe('sorterByFolderMDate', () => {
	it.each([
		[DEFAULT_FOLDER_MTIME, DEFAULT_FOLDER_MTIME, EOU, EOU, EOU, EOU],
		[OLDER_TIME, OLDER_TIME, EOU, EOU, EOU, EOU],
		[OLDER_TIME, NEWER_TIME, -1, 1, 1, -1],
		[DEFAULT_FOLDER_MTIME, NEWER_TIME, 1, -1, 1, -1],
		[NEWER_TIME, DEFAULT_FOLDER_MTIME, -1, 1, -1, 1]
	])('comparing %s and %s should return %s (reversed params %s) and %s for reverse order (and %s for reversed order reversed params)',
		(dateA: number, dateB: number, orderStraight: number, orderStraightRevParams: number, orderReverse: number, orderReverseRevParams: number) => {
			const sorterFnStraight = sorterByFolderMDate()
			const sorterFnReverse = sorterByFolderMDate(true)
			const itemA: Partial<FolderItemForSorting> = {mtime: dateA}
			const itemB: Partial<FolderItemForSorting> = {mtime: dateB}
			const resultS1 = sorterFnStraight(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
			const resultS2 = sorterFnStraight(itemB as FolderItemForSorting, itemA as FolderItemForSorting)
			const resultR1 = sorterFnReverse(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
			const resultR2 = sorterFnReverse(itemB as FolderItemForSorting, itemA as FolderItemForSorting)

			const normalizedResultS1 = resultS1 < 0 ? -1 : ((resultS1 > 0) ? 1 : resultS1)
			const normalizedResultS2 = resultS2 < 0 ? -1 : ((resultS2 > 0) ? 1 : resultS2)
			const normalizedResultR1 = resultR1 < 0 ? -1 : ((resultR1 > 0) ? 1 : resultR1)
			const normalizedResultR2 = resultR2 < 0 ? -1 : ((resultR2 > 0) ? 1 : resultR2)

			// then
			expect(normalizedResultS1).toBe(orderStraight)
			expect(normalizedResultS2).toBe(orderStraightRevParams)
			expect(normalizedResultR1).toBe(orderReverse)
			expect(normalizedResultR2).toBe(orderReverseRevParams)
		})
})

describe('sorterByFolderCDate', () => {
	it.each([
		[DEFAULT_FOLDER_CTIME, DEFAULT_FOLDER_CTIME, EOU, EOU, EOU, EOU],
		[OLDER_TIME, OLDER_TIME, EOU, EOU, EOU, EOU],
		[OLDER_TIME, NEWER_TIME, -1, 1, 1, -1],
		[DEFAULT_FOLDER_CTIME, NEWER_TIME, 1, -1, 1, -1],
		[NEWER_TIME, DEFAULT_FOLDER_CTIME, -1, 1, -1, 1]
	])('comparing %s and %s should return %s (reversed params %s) and %s for reverse order (and %s for reversed order reversed params)',
		(dateA: number, dateB: number, orderStraight: number, orderStraightRevParams: number, orderReverse: number, orderReverseRevParams: number) => {
			const sorterFnStraight = sorterByFolderCDate()
			const sorterFnReverse = sorterByFolderCDate(true)
			const itemA: Partial<FolderItemForSorting> = {ctime: dateA}
			const itemB: Partial<FolderItemForSorting> = {ctime: dateB}
			const resultS1 = sorterFnStraight(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
			const resultS2 = sorterFnStraight(itemB as FolderItemForSorting, itemA as FolderItemForSorting)
			const resultR1 = sorterFnReverse(itemA as FolderItemForSorting, itemB as FolderItemForSorting)
			const resultR2 = sorterFnReverse(itemB as FolderItemForSorting, itemA as FolderItemForSorting)

			const normalizedResultS1 = resultS1 < 0 ? -1 : ((resultS1 > 0) ? 1 : resultS1)
			const normalizedResultS2 = resultS2 < 0 ? -1 : ((resultS2 > 0) ? 1 : resultS2)
			const normalizedResultR1 = resultR1 < 0 ? -1 : ((resultR1 > 0) ? 1 : resultR1)
			const normalizedResultR2 = resultR2 < 0 ? -1 : ((resultR2 > 0) ? 1 : resultR2)

			// then
			expect(normalizedResultS1).toBe(orderStraight)
			expect(normalizedResultS2).toBe(orderStraightRevParams)
			expect(normalizedResultR1).toBe(orderReverse)
			expect(normalizedResultR2).toBe(orderReverseRevParams)
		})
})

describe('fileGoesFirstWhenSameBasenameAsFolder', () => {
	const file = 'file'
	const folder = 'folder'
	it.each([
			// main scenario - file goes first unconditionally before folder with the same name
		[0, file, folder, -1, 1],
		[0, folder, file, 1, -1],
			// Not possible - two folders with the same name - the test only documents the behavior for clarity
		[0, folder, folder, 0, 0],
			// Realistic yet useless - two files with the same basename,
		[0, file, file, 0, 0],
			// Obvious cases - text compare returned !== 0, simply pass through
		[1, file, file, 1, 1],
		[1, file, folder, 1, 1],
		[1, folder, file, 1, 1],
		[1, folder, folder, 1, 1],
		[-1, file, file, -1, -1],
		[-1, file, folder, -1, -1],
		[-1, folder, file, -1, -1],
		[-1, folder, folder, -1, -1],
	])('text compare %s of %s %s gives %s (files first) and %s (folders first)',
		(textCompare: number, aIsFolder: string, bIsFolder: string, filePreferredOder: number, folderPreferredOrder: number) => {
			// given
			const a: Partial<FolderItemForSorting> = { isFolder: aIsFolder === folder }
			const b: Partial<FolderItemForSorting> = { isFolder: bIsFolder === folder }

			const resultFilePreferred: number = _unitTests.fileGoesFirstWhenSameBasenameAsFolder(textCompare, a as FolderItemForSorting, b as FolderItemForSorting)
			const resultFolderPreferred: number = _unitTests.folderGoesFirstWhenSameBasenameAsFolder(textCompare, a as FolderItemForSorting, b as FolderItemForSorting)

			// then
			expect(resultFilePreferred).toBe(filePreferredOder)
			expect(resultFolderPreferred).toBe(folderPreferredOrder)
		})
})
