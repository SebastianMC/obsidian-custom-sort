# Wildcards and Pattern Matching

This plugin stores its configuration in YAML frontmatter. The value of
`sorting-spec: |` is a multi-line string containing the plugin's sorting
specification "language" (the plugin docs call it an informal language / syntax).

In this document we may refer to it as a DSL (Domain-Specific Language): a small
purpose-built language parsed by the plugin.

In examples below, snippets may show only the sorting-spec lines (the content
that goes under `sorting-spec: |`) for brevity.

Some parts of the syntax look regex-like (for example `\d\d\d\d`), but matching
is not "full regex everywhere". In particular, the `...` token is a plugin
wildcard and should not be treated as the regex `.*`.

## The `...` wildcard

`...` is used for prefix/suffix matching and for patterns where you want to
match an arbitrary run of characters.

Examples:

- `Focus...` matches names starting with `Focus`.
- `...ive` matches names ending with `ive`.
- `A...s` matches names starting with `A` and ending with `s`.

Practical rules:

- Any characters you place next to `...` (including spaces) are literal and must
  exist in the name.
- If you want to match an exact name shape that ends where your pattern ends,
  omit `...`.

### Example: year folders

Given folders:

- `Reviewed in 2023`
- `Reviewed in 2024`
- `Reviewed in 2025`
- `Reviewed in 2026`

To match them exactly as a group, prefer:

```yaml
/folders Reviewed in 20\d\d
 > a-z
```

If you write:

```yaml
/folders Reviewed in 20\d\d ...
 > a-z
```

note the space before `...`. That space is a literal character, so this pattern
only matches names that contain a space after the year (for example `Reviewed in
2026 Q1`), and it will _not_ match exact names like `Reviewed in 2026`.

If you want to allow an optional suffix that starts with a space, but also match
the exact name, define two groups (exact first), or use an exact match without
`...`.

## Digits and ISO dates

Common digit patterns:

- `\d` matches one digit.
- `\d\d\d\d` is often used for years.

ISO date prefixes (`YYYY-MM-DD`) sort correctly as plain text, so reverse
alphabetical (`> a-z`) gives newest-first:

```yaml
/:files \d\d\d\d-\d\d-\d\d ...
 > a-z
```

## Indentation matters

In the plugin docs, the lines like `< a-z`, `> a-z`, `< modified` are referred to
as sorting instructions / sorting methods (not a YAML concept). In this file we
use the term "sorting instruction".

A sorting instruction must be indented under the group it applies to.

More precisely: inside the `sorting-spec: |` text, the sorting instruction line
must start at a greater indentation level than the group line immediately above
it (at least one extra space).

```yaml
/folders Reviewed in 20\d\d
  > a-z
```

In contrast, this is *not* grouped correctly (same indentation as the group
line):

```yaml
/folders Reviewed in 20\d\d
> a-z
```

If the sorting instruction is not indented more than the group line, the plugin
will not associate it with that group.

## Complete example (folders first, then files)

Full YAML frontmatter form:

```yaml
---
sorting-spec: |
  target-folder: 03 Literature review
  /folders Reviewed in 20\d\d
   > a-z
  /folders
   < a-z
  /:files
   < a-z
---
```
