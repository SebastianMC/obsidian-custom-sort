import {
	CustomSortGroup,
	CustomSortGroupType,
	CustomSortOrder,
	CustomSortSpec,
	DEFAULT_METADATA_FIELD_FOR_SORTING,
	NormalizerFn,
	RecognizedOrderValue,
	RegExpSpec
} from "./custom-sort-types";
import {isDefined, last} from "../utils/utils";
import {
	CompoundNumberDashRegexStr,
	CompoundNumberDotRegexStr,
	CompoundRomanNumberDashRegexStr,
	CompoundRomanNumberDotRegexStr,
	DASH_SEPARATOR,
	DOT_SEPARATOR,
	getNormalizedNumber,
	getNormalizedRomanNumber,
	NumberRegexStr,
	RomanNumberRegexStr
} from "./matchers";
import {
	FolderWildcardMatching,
	MATCH_ALL_SUFFIX,
	MATCH_CHILDREN_1_SUFFIX,
	MATCH_CHILDREN_2_SUFFIX
} from "./folder-matching-rules"

interface ProcessingContext {
	folderPath: string
	specs: Array<CustomSortSpec>
	currentSpec?: CustomSortSpec
	currentSpecGroup?: CustomSortGroup

	// Support for specific conditions (intentionally not generic approach)
	previousValidEntryWasTargetFolderAttr?: boolean  // Entry in previous non-empty valid line
}

interface ParsedSortingGroup {
	filesOnly?: boolean
	matchFilenameWithExt?: boolean
	foldersOnly?: boolean
	plainSpec?: string
	arraySpec?: Array<string>
	outsidersGroup?: boolean // Mutually exclusive with plainSpec and arraySpec
	itemToHide?: boolean
}

export enum ProblemCode {
	SyntaxError,
	SyntaxErrorInGroupSpec,
	DuplicateSortSpecForSameFolder,
	DuplicateOrderAttr,
	DanglingOrderAttr,
	MissingAttributeValue,
	NoSpaceBetweenAttributeAndValue,
	InvalidAttributeValue,
	TargetFolderNestedSpec,
	TooManyNumericSortingSymbols,
	NumericalSymbolAdjacentToWildcard,
	ItemToHideExactNameWithExtRequired,
	ItemToHideNoSupportForThreeDots,
	DuplicateWildcardSortSpecForSameFolder,
	StandardObsidianSortAllowedOnlyAtFolderLevel
}

const ContextFreeProblems = new Set<ProblemCode>([
	ProblemCode.DuplicateSortSpecForSameFolder,
	ProblemCode.DuplicateWildcardSortSpecForSameFolder
])

const ThreeDots = '...';
const ThreeDotsLength = ThreeDots.length;

const DEFAULT_SORT_ORDER = CustomSortOrder.alphabetical

interface CustomSortOrderAscDescPair {
	asc: CustomSortOrder,
	desc: CustomSortOrder,
	secondary?: CustomSortOrder
	applyToMetadataField?: string
}

// remember about .toLowerCase() before comparison!
const OrderLiterals: { [key: string]: CustomSortOrderAscDescPair } = {
	'a-z': {asc: CustomSortOrder.alphabetical, desc: CustomSortOrder.alphabeticalReverse},
	'true a-z': {asc: CustomSortOrder.trueAlphabetical, desc: CustomSortOrder.trueAlphabeticalReverse},
	'created': {asc: CustomSortOrder.byCreatedTime, desc: CustomSortOrder.byCreatedTimeReverse},
	'modified': {asc: CustomSortOrder.byModifiedTime, desc: CustomSortOrder.byModifiedTimeReverse},
	'advanced modified': {asc: CustomSortOrder.byModifiedTimeAdvanced, desc: CustomSortOrder.byModifiedTimeReverseAdvanced},
	'advanced created': {asc: CustomSortOrder.byCreatedTimeAdvanced, desc: CustomSortOrder.byCreatedTimeReverseAdvanced},

	// Advanced, for edge cases of secondary sorting, when if regexp match is the same, override the alphabetical sorting by full name
	'a-z, created': {
		asc: CustomSortOrder.alphabetical,
		desc: CustomSortOrder.alphabeticalReverse,
		secondary: CustomSortOrder.byCreatedTime
	},
	'a-z, created desc': {
		asc: CustomSortOrder.alphabetical,
		desc: CustomSortOrder.alphabeticalReverse,
		secondary: CustomSortOrder.byCreatedTimeReverse
	},
	'a-z, modified': {
		asc: CustomSortOrder.alphabetical,
		desc: CustomSortOrder.alphabeticalReverse,
		secondary: CustomSortOrder.byModifiedTime
	},
	'a-z, modified desc': {
		asc: CustomSortOrder.alphabetical,
		desc: CustomSortOrder.alphabeticalReverse,
		secondary: CustomSortOrder.byModifiedTimeReverse
	},
	'a-z, advanced created': {
		asc: CustomSortOrder.alphabetical,
		desc: CustomSortOrder.alphabeticalReverse,
		secondary: CustomSortOrder.byCreatedTimeAdvanced
	},
	'a-z, advanced created desc': {
		asc: CustomSortOrder.alphabetical,
		desc: CustomSortOrder.alphabeticalReverse,
		secondary: CustomSortOrder.byCreatedTimeReverseAdvanced
	},
	'a-z, advanced modified': {
		asc: CustomSortOrder.alphabetical,
		desc: CustomSortOrder.alphabeticalReverse,
		secondary: CustomSortOrder.byModifiedTimeAdvanced
	},
	'a-z, advanced modified desc': {
		asc: CustomSortOrder.alphabetical,
		desc: CustomSortOrder.alphabeticalReverse,
		secondary: CustomSortOrder.byModifiedTimeReverseAdvanced
	}
}

const OrderByMetadataLexeme: string = 'by-metadata:'

enum Attribute {
	TargetFolder = 1, // Starting from 1 to allow: if (attribute) { ...
	OrderAsc,
	OrderDesc,
	OrderStandardObsidian
}

const AttrLexems: { [key: string]: Attribute } = {
	// Verbose attr names
	'target-folder:': Attribute.TargetFolder,
	'order-asc:': Attribute.OrderAsc,
	'order-desc:': Attribute.OrderDesc,
	'sorting:': Attribute.OrderStandardObsidian,
	// Concise abbreviated equivalents
	'::::': Attribute.TargetFolder,
	'<': Attribute.OrderAsc,
	'\\<': Attribute.OrderAsc, // to allow single-liners in YAML
	'>': Attribute.OrderDesc,
	'\\>': Attribute.OrderDesc // to allow single-liners in YAML
}

const CURRENT_FOLDER_SYMBOL: string = '.'

interface ParsedSortingAttribute {
	nesting: number      // nesting level, 0 (default), 1+
	attribute: Attribute
	value?: any
}

type AttrValueValidatorFn = (v: string) => any | null;

const FilesGroupVerboseLexeme: string = '/:files'
const FilesGroupShortLexeme: string = '/:'
const FilesWithExtGroupVerboseLexeme: string = '/:files.'
const FilesWithExtGroupShortLexeme: string = '/:.'
const FoldersGroupVerboseLexeme: string = '/folders'
const FoldersGroupShortLexeme: string = '/'
const AnyTypeGroupLexeme: string = '%'  // See % as a combination of / and :
const HideItemShortLexeme: string = '--%'  // See % as a combination of / and :
const HideItemVerboseLexeme: string = '/--hide:'

const MetadataFieldIndicatorLexeme: string = 'with-metadata:'

const CommentPrefix: string = '//'

interface SortingGroupType {
	filesOnly?: boolean
	filenameWithExt?: boolean  // The text matching criteria should apply to filename + extension
	foldersOnly?: boolean
	itemToHide?: boolean
}

const SortingGroupPrefixes: { [key: string]: SortingGroupType } = {
	[FilesGroupShortLexeme]: {filesOnly: true},
	[FilesGroupVerboseLexeme]: {filesOnly: true},
	[FilesWithExtGroupShortLexeme]: {filesOnly: true, filenameWithExt: true},
	[FilesWithExtGroupVerboseLexeme]: {filesOnly: true, filenameWithExt: true},
	[FoldersGroupShortLexeme]: {foldersOnly: true},
	[FoldersGroupVerboseLexeme]: {foldersOnly: true},
	[AnyTypeGroupLexeme]: {},
	[HideItemShortLexeme]: {itemToHide: true},
	[HideItemVerboseLexeme]: {itemToHide: true}
}

const isThreeDots = (s: string): boolean => {
	return s === ThreeDots
}

const containsThreeDots = (s: string): boolean => {
	return s.indexOf(ThreeDots) !== -1
}

const RomanNumberRegexSymbol: string = '\\R+'                // Roman number
const CompoundRomanNumberDotRegexSymbol: string = '\\.R+'    // Compound Roman number with dot as separator
const CompoundRomanNumberDashRegexSymbol: string = '\\-R+'   // Compound Roman number with dash as separator

const NumberRegexSymbol: string = '\\d+'               // Plain number
const CompoundNumberDotRegexSymbol: string = '\\.d+'   // Compound number with dot as separator
const CompoundNumberDashRegexSymbol: string = '\\-d+'  // Compound number with dash as separator

const UnsafeRegexCharsRegex: RegExp = /[\^$.\-+\[\]{}()|*?=!\\]/g

export const escapeRegexUnsafeCharacters = (s: string): string => {
	return s.replace(UnsafeRegexCharsRegex, '\\$&')
}

const numericSortingSymbolsArr: Array<string> = [
	escapeRegexUnsafeCharacters(NumberRegexSymbol),
	escapeRegexUnsafeCharacters(RomanNumberRegexSymbol),
	escapeRegexUnsafeCharacters(CompoundNumberDotRegexSymbol),
	escapeRegexUnsafeCharacters(CompoundNumberDashRegexSymbol),
	escapeRegexUnsafeCharacters(CompoundRomanNumberDotRegexSymbol),
	escapeRegexUnsafeCharacters(CompoundRomanNumberDashRegexSymbol),
]

const numericSortingSymbolsRegex = new RegExp(numericSortingSymbolsArr.join('|'), 'gi')

export const hasMoreThanOneNumericSortingSymbol = (s: string): boolean => {
	numericSortingSymbolsRegex.lastIndex = 0
	return numericSortingSymbolsRegex.test(s) && numericSortingSymbolsRegex.test(s)
}
export const detectNumericSortingSymbols = (s: string): boolean => {
	numericSortingSymbolsRegex.lastIndex = 0
	return numericSortingSymbolsRegex.test(s)
}

export const extractNumericSortingSymbol = (s?: string): string | null => {
	if (s) {
		numericSortingSymbolsRegex.lastIndex = 0
		const matches: RegExpMatchArray | null = numericSortingSymbolsRegex.exec(s)
		return matches ? matches[0] : null
	} else {
		return null
	}
}

export interface RegExpSpecStr {
	regexpStr: string
	normalizerFn: NormalizerFn
}

// Exposed as named exports to allow unit testing
export const RomanNumberNormalizerFn: NormalizerFn = (s: string) => getNormalizedRomanNumber(s)
export const CompoundDotRomanNumberNormalizerFn: NormalizerFn = (s: string) => getNormalizedRomanNumber(s, DOT_SEPARATOR)
export const CompoundDashRomanNumberNormalizerFn: NormalizerFn = (s: string) => getNormalizedRomanNumber(s, DASH_SEPARATOR)
export const NumberNormalizerFn: NormalizerFn = (s: string) => getNormalizedNumber(s)
export const CompoundDotNumberNormalizerFn: NormalizerFn = (s: string) => getNormalizedNumber(s, DOT_SEPARATOR)
export const CompoundDashNumberNormalizerFn: NormalizerFn = (s: string) => getNormalizedNumber(s, DASH_SEPARATOR)

const numericSortingSymbolToRegexpStr: { [key: string]: RegExpSpecStr } = {
	[RomanNumberRegexSymbol.toLowerCase()]: {
		regexpStr: RomanNumberRegexStr,
		normalizerFn: RomanNumberNormalizerFn
	},
	[CompoundRomanNumberDotRegexSymbol.toLowerCase()]: {
		regexpStr: CompoundRomanNumberDotRegexStr,
		normalizerFn: CompoundDotRomanNumberNormalizerFn
	},
	[CompoundRomanNumberDashRegexSymbol.toLowerCase()]: {
		regexpStr: CompoundRomanNumberDashRegexStr,
		normalizerFn: CompoundDashRomanNumberNormalizerFn
	},
	[NumberRegexSymbol.toLowerCase()]: {
		regexpStr: NumberRegexStr,
		normalizerFn: NumberNormalizerFn
	},
	[CompoundNumberDotRegexSymbol.toLowerCase()]: {
		regexpStr: CompoundNumberDotRegexStr,
		normalizerFn: CompoundDotNumberNormalizerFn
	},
	[CompoundNumberDashRegexSymbol.toLowerCase()]: {
		regexpStr: CompoundNumberDashRegexStr,
		normalizerFn: CompoundDashNumberNormalizerFn
	}
}

export interface ExtractedNumericSortingSymbolInfo {
	regexpSpec: RegExpSpec
	prefix: string
	suffix: string
}

export enum RegexpUsedAs {
	InUnitTest,
	Prefix,
	Suffix,
	FullMatch
}

export const convertPlainStringWithNumericSortingSymbolToRegex = (s?: string, actAs?: RegexpUsedAs): ExtractedNumericSortingSymbolInfo | null => {
	const detectedSymbol: string | null = extractNumericSortingSymbol(s)
	if (detectedSymbol) {
		const replacement: RegExpSpecStr = numericSortingSymbolToRegexpStr[detectedSymbol.toLowerCase()]
		const [extractedPrefix, extractedSuffix] = s!.split(detectedSymbol)
		const regexPrefix: string = actAs === RegexpUsedAs.Prefix || actAs === RegexpUsedAs.FullMatch ? '^' : ''
		const regexSuffix: string = actAs === RegexpUsedAs.Suffix || actAs === RegexpUsedAs.FullMatch ? '$' : ''
		return {
			regexpSpec: {
				regex: new RegExp(`${regexPrefix}${escapeRegexUnsafeCharacters(extractedPrefix)}${replacement.regexpStr}${escapeRegexUnsafeCharacters(extractedSuffix)}${regexSuffix}`, 'i'),
				normalizerFn: replacement.normalizerFn
			},
			prefix: extractedPrefix,
			suffix: extractedSuffix
		}
	} else {
		return null
	}
}

export interface FolderPathToSortSpecMap {
	[key: string]: CustomSortSpec
}

export interface SortSpecsCollection {
	sortSpecByPath: FolderPathToSortSpecMap
	sortSpecByWildcard?: FolderWildcardMatching<CustomSortSpec>
}

interface AdjacencyInfo {
	noPrefix: boolean,
	noSuffix: boolean
}

const checkAdjacency = (sortingSymbolInfo: ExtractedNumericSortingSymbolInfo): AdjacencyInfo => {
	return {
		noPrefix: sortingSymbolInfo.prefix.length === 0,
		noSuffix: sortingSymbolInfo.suffix.length === 0
	}
}

const endsWithWildcardPatternSuffix = (path: string): boolean => {
	return path.endsWith(MATCH_CHILDREN_1_SUFFIX) ||
		path.endsWith(MATCH_CHILDREN_2_SUFFIX) ||
		path.endsWith(MATCH_ALL_SUFFIX)
}

enum WildcardPriority {
	NO_WILDCARD = 1,
	MATCH_CHILDREN,
	MATCH_ALL
}

const stripWildcardPatternSuffix = (path: string): [path: string, priority: number] => {
	if (path.endsWith(MATCH_ALL_SUFFIX)) {
		path = path.slice(0, -MATCH_ALL_SUFFIX.length)
		return [
			path.length > 0 ? path : '/',
			WildcardPriority.MATCH_ALL
		]
	}
	if (path.endsWith(MATCH_CHILDREN_1_SUFFIX)) {
		path = path.slice(0, -MATCH_CHILDREN_1_SUFFIX.length)
		return [
			path.length > 0 ? path : '/',
			WildcardPriority.MATCH_CHILDREN,
		]
	}
	if (path.endsWith(MATCH_CHILDREN_2_SUFFIX)) {
		path = path.slice(0, -MATCH_CHILDREN_2_SUFFIX.length)
		return [
			path.length > 0 ? path : '/',
			WildcardPriority.MATCH_CHILDREN
		]
	}
	return [
		path,
		WildcardPriority.NO_WILDCARD
	]
}

// Simplistic
const extractIdentifier = (text: string, defaultResult?: string): string | undefined => {
	const identifier: string = text.trim().split(' ')?.[0]?.trim()
	return identifier ? identifier : defaultResult
}

const ADJACENCY_ERROR: string = "Numerical sorting symbol must not be directly adjacent to a wildcard because of potential performance problem. An additional explicit separator helps in such case."

export class SortingSpecProcessor {
	ctx: ProcessingContext
	currentEntryLine: string | null
	currentEntryLineIdx: number | null
	currentSortingSpecContainerFilePath: string | null
	problemAlreadyReportedForCurrentLine: boolean | null
	recentErrorMessage: string | null

	// Helper map to deal with rule priorities for the same path
	//   and also detect non-wildcard duplicates.
	//   The wildcard duplicates were detected prior to this point, no need to bother about them
	pathMatchPriorityForPath: {[key: string]: WildcardPriority} = {}

	// Logger parameter exposed to support unit testing of error cases as well as capturing error messages
	//  for in-app presentation
	constructor(private errorLogger?: typeof console.log) {
	}

	// root level parser function
	parseSortSpecFromText(text: Array<string>,
						  folderPath: string,
						  sortingSpecFileName: string,
						  collection?: SortSpecsCollection | null
	): SortSpecsCollection | null | undefined {
		// reset / init processing state after potential previous invocation
		this.ctx = {
			folderPath: folderPath,   // location of the sorting spec file
			specs: []
		};
		this.currentEntryLine = null
		this.currentEntryLineIdx = null
		this.currentSortingSpecContainerFilePath = null
		this.problemAlreadyReportedForCurrentLine = null
		this.recentErrorMessage = null

		let success: boolean = false;
		let lineIdx: number = 0;
		for (let entryLine of text) {
			lineIdx++
			this.currentEntryLine = entryLine
			this.currentEntryLineIdx = lineIdx
			this.currentSortingSpecContainerFilePath = `${folderPath === '/' ? '' : folderPath}/${sortingSpecFileName}`
			this.problemAlreadyReportedForCurrentLine = false

			const trimmedEntryLine: string = entryLine.trim()
			if (trimmedEntryLine === '') continue
			if (trimmedEntryLine.startsWith(CommentPrefix)) continue

			success = false   // Empty lines and comments are OK, that's why setting so late

			const attr: ParsedSortingAttribute | null = this.parseAttribute(entryLine);
			if (attr) {
				success = this.processParsedSortingAttribute(attr);
				this.ctx.previousValidEntryWasTargetFolderAttr = success && (attr.attribute === Attribute.TargetFolder)
			} else if (!this.problemAlreadyReportedForCurrentLine && !this.checkForRiskyAttrSyntaxError(entryLine)) {
				let group: ParsedSortingGroup | null = this.parseSortingGroupSpec(entryLine);
				if (!this.problemAlreadyReportedForCurrentLine && !group) {
					// Default for unrecognized syntax: treat the line as exact name (of file or folder)
					group = {plainSpec: trimmedEntryLine}
				}
				if (group) {
					success = this.processParsedSortGroupSpec(group);
				}
				this.ctx.previousValidEntryWasTargetFolderAttr = undefined
			}
			if (!success) {
				if (!this.problemAlreadyReportedForCurrentLine) {
					this.problem(ProblemCode.SyntaxError, "Sorting specification line doesn't match any supported syntax")
				}
				break;
			}
		}

		if (success) {
			if (this.ctx.specs.length > 0) {
				for (let spec of this.ctx.specs) {
					this.postprocessSortSpec(spec)
				}

				let sortspecByWildcard: FolderWildcardMatching<CustomSortSpec> | undefined
				for (let spec of this.ctx.specs) {
					// Consume the folder paths ending with wildcard specs
					for (let idx = 0; idx<spec.targetFoldersPaths.length; idx++) {
						const path = spec.targetFoldersPaths[idx]
						if (endsWithWildcardPatternSuffix(path)) {
							sortspecByWildcard = sortspecByWildcard ?? new FolderWildcardMatching<CustomSortSpec>()
							const ruleAdded = sortspecByWildcard.addWildcardDefinition(path, spec)
							if (ruleAdded?.errorMsg) {
								this.problem(ProblemCode.DuplicateWildcardSortSpecForSameFolder, ruleAdded?.errorMsg)
								return null // Failure - not allow duplicate wildcard specs for the same folder
							}
						}
					}
				}

				if (sortspecByWildcard) {
					collection = collection ?? { sortSpecByPath:{} }
					collection.sortSpecByWildcard = sortspecByWildcard
				}

				for (let spec of this.ctx.specs) {
					for (let idx = 0; idx < spec.targetFoldersPaths.length; idx++) {
						const originalPath = spec.targetFoldersPaths[idx]
						collection = collection ?? { sortSpecByPath: {} }
						let detectedWildcardPriority: WildcardPriority
						let path: string
						[path, detectedWildcardPriority] = stripWildcardPatternSuffix(originalPath)
						let storeTheSpec: boolean = true
						const preexistingSortSpecPriority: WildcardPriority = this.pathMatchPriorityForPath[path]
						if (preexistingSortSpecPriority) {
							if (preexistingSortSpecPriority === WildcardPriority.NO_WILDCARD && detectedWildcardPriority === WildcardPriority.NO_WILDCARD) {
								this.problem(ProblemCode.DuplicateSortSpecForSameFolder, `Duplicate sorting spec for folder ${path}`)
								return null // Failure - not allow duplicate specs for the same no-wildcard folder path
							} else if (detectedWildcardPriority >= preexistingSortSpecPriority) {
								// Ignore lower priority rule
								storeTheSpec = false
							}
						}
						if (storeTheSpec) {
							collection.sortSpecByPath[path] = spec
							this.pathMatchPriorityForPath[path] = detectedWildcardPriority
						}
					}
				}
			}
			return collection
		} else {
			return null
		}
	}

	problem = (code: ProblemCode, details: string): void => {
		const problemLabel = ProblemCode[code]
		let logger: typeof console.log = this.errorLogger ?? console.error
		const hasLineContext: boolean = !ContextFreeProblems.has(code)
		const lineContext = (hasLineContext) ? ` line ${this.currentEntryLineIdx} of` : ''

		logger(`Sorting specification problem: ${code}:${problemLabel} ${details} ---` +
			`encountered in${lineContext} sorting spec in file ${this.currentSortingSpecContainerFilePath}`)
		if (lineContext) {
			logger(`Content of problematic line: "${this.currentEntryLine}"`)
		}

		this.recentErrorMessage =
			`File: ${this.currentSortingSpecContainerFilePath}\n` +
			(hasLineContext ? `Specification line #${this.currentEntryLineIdx}: "${this.currentEntryLine}"\n` : '') +
			`Problem: ${code}:${problemLabel}\n` +
			`Details: ${details}`
		this.problemAlreadyReportedForCurrentLine = true
	}

	// level 1 parser functions defined in order of occurrence and dependency

	private parseAttribute = (line: string): ParsedSortingAttribute | null => {
		const lineTrimmedStart: string = line.trimStart()
		const nestingLevel: number = line.length - lineTrimmedStart.length

		// Attribute lexeme (name or alias) requires trailing space separator
		const indexOfSpace: number = lineTrimmedStart.indexOf(' ')
		if (indexOfSpace === -1) {
			return null;   // Seemingly not an attribute or a syntax error, to be checked separately
		}
		const firstLexeme: string = lineTrimmedStart.substring(0, indexOfSpace)
		const firstLexemeLowerCase: string = firstLexeme.toLowerCase()
		const recognizedAttr: Attribute = AttrLexems[firstLexemeLowerCase]

		if (recognizedAttr) {
			const attrValue: string = lineTrimmedStart.substring(indexOfSpace).trim()
			if (attrValue) {
				const validator: AttrValueValidatorFn = this.attrValueValidators[recognizedAttr]
				if (validator) {
					const validValue = validator(attrValue);
					if (validValue) {
						return {
							nesting: nestingLevel,
							attribute: recognizedAttr,
							value: validValue
						}
					} else {
						this.problem(ProblemCode.InvalidAttributeValue, `Invalid value of the attribute "${firstLexeme}"`)
					}
				} else {
					return {
						nesting: nestingLevel,
						attribute: recognizedAttr,
						value: attrValue
					}
				}
			} else {
				this.problem(ProblemCode.MissingAttributeValue, `Attribute "${firstLexeme}" requires a value to follow`)
			}
		}
		return null; // Seemingly not an attribute or not a valid attribute expression (respective syntax error could have been logged)
	}

	private processParsedSortingAttribute(attr: ParsedSortingAttribute): boolean {
		if (attr.attribute === Attribute.TargetFolder) {
			if (attr.nesting === 0) { // root-level attribute causing creation of new spec or decoration of a previous one
				if (this.ctx.previousValidEntryWasTargetFolderAttr) {
					if (this.ctx.currentSpec) {
						this.ctx.currentSpec.targetFoldersPaths.push(attr.value)
					} else {
						// Should never reach this execution path, yet for sanity and clarity:
						this.ctx.currentSpec = this.putNewSpecForNewTargetFolder(attr.value)
					}
				} else {
					this.ctx.currentSpec = this.putNewSpecForNewTargetFolder(attr.value)
				}
				return true
			} else {
				this.problem(ProblemCode.TargetFolderNestedSpec, `Nested (indented) specification of target folder is not allowed`)
				return false
			}
		} else if (attr.attribute === Attribute.OrderAsc || attr.attribute === Attribute.OrderDesc || attr.attribute === Attribute.OrderStandardObsidian) {
			if (attr.nesting === 0) {
				if (!this.ctx.currentSpec) {
					this.ctx.currentSpec = this.putNewSpecForNewTargetFolder()
				}
				if (this.ctx.currentSpec.defaultOrder) {
					const folderPathsForProblemMsg: string = this.ctx.currentSpec.targetFoldersPaths.join(' :: ');
					this.problem(ProblemCode.DuplicateOrderAttr, `Duplicate order specification for folder(s) ${folderPathsForProblemMsg}`)
					return false;
				}
				this.ctx.currentSpec.defaultOrder = (attr.value as RecognizedOrderValue).order
				this.ctx.currentSpec.byMetadataField = (attr.value as RecognizedOrderValue).applyToMetadataField
				return true;
			} else if (attr.nesting > 0) { // For now only distinguishing nested (indented) and not-nested (not-indented), the depth doesn't matter
				if (!this.ctx.currentSpec || !this.ctx.currentSpecGroup) {
					this.problem(ProblemCode.DanglingOrderAttr, `Nested (indented) attribute requires prior sorting group definition`)
					return false;
				}
				if (this.ctx.currentSpecGroup.order) {
					const folderPathsForProblemMsg: string = this.ctx.currentSpec.targetFoldersPaths.join(' :: ');
					this.problem(ProblemCode.DuplicateOrderAttr, `Duplicate order specification for a sorting rule of folder ${folderPathsForProblemMsg}`)
					return false;
				}
				if ((attr.value as RecognizedOrderValue).order === CustomSortOrder.standardObsidian) {
					this.problem(ProblemCode.StandardObsidianSortAllowedOnlyAtFolderLevel, `The standard Obsidian sort order is only allowed at a folder level (not nested syntax)`)
					return false;
				}
				this.ctx.currentSpecGroup.order = (attr.value as RecognizedOrderValue).order
				this.ctx.currentSpecGroup.byMetadataField = (attr.value as RecognizedOrderValue).applyToMetadataField
				this.ctx.currentSpecGroup.secondaryOrder = (attr.value as RecognizedOrderValue).secondaryOrder
				return true;
			}
		}
		return false;
	}

	private checkForRiskyAttrSyntaxError = (line: string): boolean => {
		const lineTrimmedStart: string = line.trimStart()
		const lineTrimmedStartLowerCase: string = lineTrimmedStart.toLowerCase()
		// no space present, check for potential syntax errors
		for (let attrLexeme of Object.keys(AttrLexems)) {
			if (lineTrimmedStartLowerCase.startsWith(attrLexeme)) {
				const originalAttrLexeme: string = lineTrimmedStart.substring(0, attrLexeme.length)
				if (lineTrimmedStartLowerCase.length === attrLexeme.length) {
					this.problem(ProblemCode.MissingAttributeValue, `Attribute "${originalAttrLexeme}" requires a value to follow`)
					return true
				} else {
					this.problem(ProblemCode.NoSpaceBetweenAttributeAndValue, `Space required after attribute name "${originalAttrLexeme}"`)
					return true
				}
			}
		}
		return false
	}

	private parseSortingGroupSpec = (line: string): ParsedSortingGroup | null => {
		const s: string = line.trim()

		if (hasMoreThanOneNumericSortingSymbol(s)) {
			this.problem(ProblemCode.TooManyNumericSortingSymbols, 'Maximum one numeric sorting indicator allowed per line')
			return null
		}

		const prefixAlone: SortingGroupType = SortingGroupPrefixes[s]
		if (prefixAlone) {
			if (prefixAlone.itemToHide) {
				this.problem(ProblemCode.ItemToHideExactNameWithExtRequired, 'Exact name with ext of file or folders to hide is required')
				return null
			} else { // !prefixAlone.itemToHide
				return {
					outsidersGroup: true,
					filesOnly: prefixAlone.filesOnly,
					foldersOnly: prefixAlone.foldersOnly
				}
			}
		}

		for (const prefix of Object.keys(SortingGroupPrefixes)) {
			if (s.startsWith(prefix + ' ')) {
				const sortingGroupType: SortingGroupType = SortingGroupPrefixes[prefix]
				if (sortingGroupType.itemToHide) {
					return {
						itemToHide: true,
						plainSpec: s.substring(prefix.length + 1),
						filesOnly: sortingGroupType.filesOnly,
						foldersOnly: sortingGroupType.foldersOnly
					}
				} else { // !sortingGroupType.itemToHide
					return {
						plainSpec: s.substring(prefix.length + 1),
						filesOnly: sortingGroupType.filesOnly,
						foldersOnly: sortingGroupType.foldersOnly,
						matchFilenameWithExt: sortingGroupType.filenameWithExt
					}
				}
			}
		}

		return null;
	}

	private processParsedSortGroupSpec(group: ParsedSortingGroup): boolean {
		if (!this.ctx.currentSpec) {
			this.ctx.currentSpec = this.putNewSpecForNewTargetFolder()
		}

		if (group.plainSpec) {
			group.arraySpec = this.convertPlainStringSortingGroupSpecToArraySpec(group.plainSpec)
			delete group.plainSpec
		}

		if (group.itemToHide) {
			if (!this.consumeParsedItemToHide(group)) {
				this.problem(ProblemCode.ItemToHideNoSupportForThreeDots, 'For hiding of file or folder, the exact name with ext is required and no numeric sorting indicator allowed')
				return false
			} else {
				return true
			}
		} else { // !group.itemToHide
			const newGroup: CustomSortGroup | null = this.consumeParsedSortingGroupSpec(group)
			if (newGroup) {
				if (this.adjustSortingGroupForNumericSortingSymbol(newGroup)) {
					if (this.ctx.currentSpec) {
						this.ctx.currentSpec.groups.push(newGroup)
						this.ctx.currentSpecGroup = newGroup
						return true;
					} else {
						return false
					}
				} else {
					return false
				}
			} else {
				return false;
			}
		}
	}

	private postprocessSortSpec(spec: CustomSortSpec): void {
		// clean up to prevent false warnings in console
		spec.outsidersGroupIdx = undefined
		spec.outsidersFilesGroupIdx = undefined
		spec.outsidersFoldersGroupIdx = undefined
		let outsidersGroupForFolders: boolean | undefined
		let outsidersGroupForFiles: boolean | undefined

		// process all defined sorting groups
		for (let groupIdx = 0; groupIdx < spec.groups.length; groupIdx++) {
			const group: CustomSortGroup = spec.groups[groupIdx];
			if (group.type === CustomSortGroupType.Outsiders) {
				if (group.filesOnly) {
					if (isDefined(spec.outsidersFilesGroupIdx)) {
						console.warn(`Ignoring duplicate Outsiders-files sorting group definition in sort spec for folder '${last(spec.targetFoldersPaths)}'`)
					} else {
						spec.outsidersFilesGroupIdx = groupIdx
						outsidersGroupForFiles = true
					}
				} else if (group.foldersOnly) {
					if (isDefined(spec.outsidersFoldersGroupIdx)) {
						console.warn(`Ignoring duplicate Outsiders-folders sorting group definition in sort spec for folder '${last(spec.targetFoldersPaths)}'`)
					} else {
						spec.outsidersFoldersGroupIdx = groupIdx
						outsidersGroupForFolders = true
					}
				} else {
					if (isDefined(spec.outsidersGroupIdx)) {
						console.warn(`Ignoring duplicate Outsiders sorting group definition in sort spec for folder '${last(spec.targetFoldersPaths)}'`)
					} else {
						spec.outsidersGroupIdx = groupIdx
						outsidersGroupForFolders = true
						outsidersGroupForFiles = true
					}
				}
			}
		}
		if (isDefined(spec.outsidersGroupIdx) && (isDefined(spec.outsidersFilesGroupIdx) || isDefined(spec.outsidersFoldersGroupIdx))) {
			console.warn(`Inconsistent Outsiders sorting group definition in sort spec for folder '${last(spec.targetFoldersPaths)}'`)
		}
		// For consistency and to simplify sorting code later on, implicitly append a single catch-all Outsiders group
		if (!(outsidersGroupForFiles && outsidersGroupForFolders)) {
			spec.outsidersGroupIdx = spec.groups.length
			spec.groups.push({
				type: CustomSortGroupType.Outsiders
			})
		}

		// Populate sorting order for a bit more efficient sorting later on
		for (let group of spec.groups) {
			if (!group.order) {
				group.order = spec.defaultOrder ?? DEFAULT_SORT_ORDER
				group.byMetadataField = spec.byMetadataField
			}
		}

		const CURRENT_FOLDER_PREFIX: string = `${CURRENT_FOLDER_SYMBOL}/`

		// Replace the dot-folder names (coming from: 'target-folder: .') with actual folder names
		spec.targetFoldersPaths.forEach((path, idx) => {
			if (path === CURRENT_FOLDER_SYMBOL) {
				spec.targetFoldersPaths[idx] = this.ctx.folderPath
			} else if (path.startsWith(CURRENT_FOLDER_PREFIX)) {
				spec.targetFoldersPaths[idx] = `${this.ctx.folderPath}/${path.substring(CURRENT_FOLDER_PREFIX.length)}`
			}
		});
	}

	// level 2 parser functions defined in order of occurrence and dependency

	private validateTargetFolderAttrValue = (v: string): string | null => {
		if (v) {
			const trimmed: string = v.trim();
			return trimmed ? trimmed : null; // Can't use ?? - it treats '' as a valid value
		} else {
			return null;
		}
	}

	private internalValidateOrderAttrValue = (v: string): CustomSortOrderAscDescPair | null => {
		v = v.trim();
		let orderLiteral: string = v
		let metadataSpec: Partial<CustomSortOrderAscDescPair> = {}
		let applyToMetadata: boolean = false

		if (v.indexOf(OrderByMetadataLexeme) > 0) { // Intentionally > 0 -> not allow the metadata lexeme alone
			const pieces: Array<string> = v.split(OrderByMetadataLexeme)
			// there are at least two pieces by definition, prefix and suffix of the metadata lexeme
			orderLiteral = pieces[0]?.trim()
			let metadataFieldName: string = pieces[1]?.trim()
			if (metadataFieldName) {
				metadataSpec.applyToMetadataField = metadataFieldName
			}
			applyToMetadata = true
		}

		let attr: CustomSortOrderAscDescPair | null = orderLiteral ? OrderLiterals[orderLiteral.toLowerCase()] : null
		if (attr) {
			if (applyToMetadata &&
				(attr.asc === CustomSortOrder.alphabetical || attr.desc === CustomSortOrder.alphabeticalReverse ||
				 attr.asc === CustomSortOrder.trueAlphabetical || attr.desc === CustomSortOrder.trueAlphabeticalReverse )) {

				const trueAlphabetical: boolean = attr.asc === CustomSortOrder.trueAlphabetical || attr.desc === CustomSortOrder.trueAlphabeticalReverse

				// Create adjusted copy
				attr = {
					...attr,
					asc: trueAlphabetical ? CustomSortOrder.byMetadataFieldTrueAlphabetical : CustomSortOrder.byMetadataFieldAlphabetical,
					desc: trueAlphabetical ? CustomSortOrder.byMetadataFieldTrueAlphabeticalReverse : CustomSortOrder.byMetadataFieldAlphabeticalReverse
				}
			} else {    // For orders different from alphabetical (and reverse) a reference to metadata is not supported
				metadataSpec.applyToMetadataField = undefined
			}
		}

		return attr ? {...attr, ...metadataSpec} : null
	}

	private validateOrderAscAttrValue = (v: string): RecognizedOrderValue | null => {
		const recognized: CustomSortOrderAscDescPair | null = this.internalValidateOrderAttrValue(v)
		return recognized ? {
			order: recognized.asc,
			secondaryOrder: recognized.secondary,
			applyToMetadataField: recognized.applyToMetadataField
		} : null;
	}

	private validateOrderDescAttrValue = (v: string): RecognizedOrderValue | null => {
		const recognized: CustomSortOrderAscDescPair | null = this.internalValidateOrderAttrValue(v)
		return recognized ? {
			order: recognized.desc,
			secondaryOrder: recognized.secondary,
			applyToMetadataField: recognized.applyToMetadataField
		} : null;
	}

	private validateSortingAttrValue = (v: string): RecognizedOrderValue | null => {
		// for now only a single fixed lexem
		const recognized: boolean = v.trim().toLowerCase() === 'standard'
		return recognized ? {
			order: CustomSortOrder.standardObsidian
		} : null;
	}

	attrValueValidators: { [key in Attribute]: AttrValueValidatorFn } = {
		[Attribute.TargetFolder]: this.validateTargetFolderAttrValue.bind(this),
		[Attribute.OrderAsc]: this.validateOrderAscAttrValue.bind(this),
		[Attribute.OrderDesc]: this.validateOrderDescAttrValue.bind(this),
		[Attribute.OrderStandardObsidian]: this.validateSortingAttrValue.bind(this)
	}

	 convertPlainStringSortingGroupSpecToArraySpec = (spec: string): Array<string> => {
		spec = spec.trim()
		if (isThreeDots(spec)) {
			return [ThreeDots]
		}
		if (spec.startsWith(ThreeDots)) {
			return [ThreeDots, spec.substring(ThreeDotsLength)];
		}
		if (spec.endsWith(ThreeDots)) {
			return [spec.substring(0, spec.length - ThreeDotsLength), ThreeDots];
		}

		const idx = spec.indexOf(ThreeDots);
		if (idx > 0) {
			return [
				spec.substring(0, idx),
				ThreeDots,
				spec.substring(idx + ThreeDotsLength)
			];
		}

		// Unrecognized, treat as exact match
		return [spec];
	}

	private putNewSpecForNewTargetFolder(folderPath?: string): CustomSortSpec {
		const newSpec: CustomSortSpec = {
			targetFoldersPaths: [folderPath ?? this.ctx.folderPath],
			groups: []
		}

		this.ctx.specs.push(newSpec);
		this.ctx.currentSpec = undefined;
		this.ctx.currentSpecGroup = undefined;

		return newSpec
	}

	// Detection of slippery syntax errors which can confuse user due to false positive parsing with an unexpected sorting result

	private consumeParsedItemToHide(spec: ParsedSortingGroup): boolean {
		if (spec.arraySpec?.length === 1) {
			const theOnly: string = spec.arraySpec[0]
			if (!isThreeDots(theOnly)) {
				const nameWithExt: string = theOnly.trim()
				if (nameWithExt) { // Sanity check
					if (!detectNumericSortingSymbols(nameWithExt)) {
						if (this.ctx.currentSpec) {
							const itemsToHide: Set<string> = this.ctx.currentSpec?.itemsToHide ?? new Set<string>()
							itemsToHide.add(nameWithExt)
							this.ctx.currentSpec.itemsToHide = itemsToHide
							return true
						}
					}
				}
			}
		}
		return false
	}

	private consumeParsedSortingGroupSpec = (spec: ParsedSortingGroup): CustomSortGroup | null => {
		if (spec.outsidersGroup) {
			return {
				type: CustomSortGroupType.Outsiders,
				filesOnly: spec.filesOnly,
				foldersOnly: spec.foldersOnly,
				matchFilenameWithExt: spec.matchFilenameWithExt  // Doesn't make sense for matching, yet for multi-match
			}               									    // theoretically could match the sorting of matched files
		}

		if (spec.arraySpec?.length === 1) {
			const theOnly: string = spec.arraySpec[0]
			if (isThreeDots(theOnly)) {
				return {
					type: CustomSortGroupType.MatchAll,
					filesOnly: spec.filesOnly,
					foldersOnly: spec.foldersOnly,
					matchFilenameWithExt: spec.matchFilenameWithExt  // Doesn't make sense for matching, yet for multi-match
				}               									    // theoretically could match the sorting of matched files
			} else {
				if (theOnly.startsWith(MetadataFieldIndicatorLexeme)) {
					const metadataFieldName: string | undefined = extractIdentifier(
						theOnly.substring(MetadataFieldIndicatorLexeme.length),
						DEFAULT_METADATA_FIELD_FOR_SORTING
					)
					return {
						type: CustomSortGroupType.HasMetadataField,
						withMetadataFieldName: metadataFieldName,
						filesOnly: spec.filesOnly,
						foldersOnly: spec.foldersOnly,
						matchFilenameWithExt: spec.matchFilenameWithExt
					}
				} else {
					// For non-three dots single text line assume exact match group
					return {
						type: CustomSortGroupType.ExactName,
						exactText: theOnly,
						filesOnly: spec.filesOnly,
						foldersOnly: spec.foldersOnly,
						matchFilenameWithExt: spec.matchFilenameWithExt
					}
				}
			}
		}
		if (spec.arraySpec?.length === 2) {
			const theFirst: string = spec.arraySpec[0]
			const theSecond: string = spec.arraySpec[1]
			if (isThreeDots(theFirst) && !isThreeDots(theSecond) && !containsThreeDots(theSecond)) {
				return {
					type: CustomSortGroupType.ExactSuffix,
					exactSuffix: theSecond,
					filesOnly: spec.filesOnly,
					foldersOnly: spec.foldersOnly,
					matchFilenameWithExt: spec.matchFilenameWithExt
				}
			} else if (!isThreeDots(theFirst) && isThreeDots(theSecond) && !containsThreeDots(theFirst)) {
				return {
					type: CustomSortGroupType.ExactPrefix,
					exactPrefix: theFirst,
					filesOnly: spec.filesOnly,
					foldersOnly: spec.foldersOnly,
					matchFilenameWithExt: spec.matchFilenameWithExt
				}
			} else {
				// both are three dots or contain three dots or
				this.problem(ProblemCode.SyntaxErrorInGroupSpec, "three dots occurring more than once and no more text specified")
				return null;
			}
		}
		if (spec.arraySpec?.length === 3) {
			const theFirst: string = spec.arraySpec[0]
			const theMiddle: string = spec.arraySpec[1]
			const theLast: string = spec.arraySpec[2]
			if (isThreeDots(theMiddle)
				&& !isThreeDots(theFirst)
				&& !isThreeDots(theLast)
				&& !containsThreeDots(theLast)) {
				return {
					type: CustomSortGroupType.ExactHeadAndTail,
					exactPrefix: theFirst,
					exactSuffix: theLast,
					filesOnly: spec.filesOnly,
					foldersOnly: spec.foldersOnly,
					matchFilenameWithExt: spec.matchFilenameWithExt
				}
			} else {
				// both are three dots or three dots occurring more times
				this.problem(ProblemCode.SyntaxErrorInGroupSpec, "three dots occurring more than once or unrecognized specification of sorting rule")
				return null;
			}
		}
		this.problem(ProblemCode.SyntaxErrorInGroupSpec, "Unrecognized specification of sorting rule")
		return null;
	}

	// Returns true if no numeric sorting symbol (hence no adjustment) or if correctly adjusted with regex
	private adjustSortingGroupForNumericSortingSymbol = (group: CustomSortGroup) => {
		switch (group.type) {
			case CustomSortGroupType.ExactPrefix:
				const numSymbolInPrefix = convertPlainStringWithNumericSortingSymbolToRegex(group.exactPrefix, RegexpUsedAs.Prefix)
				if (numSymbolInPrefix) {
					if (checkAdjacency(numSymbolInPrefix).noSuffix) {
						this.problem(ProblemCode.NumericalSymbolAdjacentToWildcard, ADJACENCY_ERROR)
						return false;
					}
					delete group.exactPrefix
					group.regexSpec = numSymbolInPrefix.regexpSpec
				}
				break;
			case CustomSortGroupType.ExactSuffix:
				const numSymbolInSuffix = convertPlainStringWithNumericSortingSymbolToRegex(group.exactSuffix, RegexpUsedAs.Suffix)
				if (numSymbolInSuffix) {
					if (checkAdjacency(numSymbolInSuffix).noPrefix) {
						this.problem(ProblemCode.NumericalSymbolAdjacentToWildcard, ADJACENCY_ERROR)
						return false;
					}
					delete group.exactSuffix
					group.regexSpec = numSymbolInSuffix.regexpSpec
				}
				break;
			case CustomSortGroupType.ExactHeadAndTail:
				const numSymbolInHead = convertPlainStringWithNumericSortingSymbolToRegex(group.exactPrefix, RegexpUsedAs.Prefix)
				if (numSymbolInHead) {
					if (checkAdjacency(numSymbolInHead).noSuffix) {
						this.problem(ProblemCode.NumericalSymbolAdjacentToWildcard, ADJACENCY_ERROR)
						return false;
					}
					delete group.exactPrefix
					group.regexSpec = numSymbolInHead.regexpSpec
				} else {
					const numSymbolInTail = convertPlainStringWithNumericSortingSymbolToRegex(group.exactSuffix, RegexpUsedAs.Suffix)
					if (numSymbolInTail) {
						if (checkAdjacency(numSymbolInTail).noPrefix) {
							this.problem(ProblemCode.NumericalSymbolAdjacentToWildcard, ADJACENCY_ERROR)
							return false;
						}
						delete group.exactSuffix
						group.regexSpec = numSymbolInTail.regexpSpec
					}
				}
				break;
			case CustomSortGroupType.ExactName:
				const numSymbolInExactMatch = convertPlainStringWithNumericSortingSymbolToRegex(group.exactText, RegexpUsedAs.FullMatch)
				if (numSymbolInExactMatch) {
					delete group.exactText
					group.regexSpec = numSymbolInExactMatch.regexpSpec
				}
				break;
		}
		return true
	}
}
