# Dataset Capture v0.3 — Subtitle Content Decisions

## Purpose
Capture one meaningful subtitle editing decision per focus-to-blur edit session. Key-by-key input is never stored as DecisionRecord.

## Decision type
`subtitle-content`

## Capture boundary
- focus: remember committed `subtitleText` before editing
- input: preserve existing preview, warning and autosave behavior only
- blur: compare before/final and append at most one DecisionRecord
- unchanged normalized text: no record
- bulk regenerate/clear, restore and automatic scene operations: out of scope

## Stored structure
Both `proposal` and `finalDecision` keep:
- normalized raw text (LF newlines)
- `cardCount`
- `forcedLineBreakCount`
- `cards` (blank-line separated, single newlines retained inside a card)

`humanAction.changeKinds` can contain:
- `text`
- `forced-line-break`
- `card-split`

## Compatibility
- schemaVersion remains 4
- IndexedDB DB_VERSION remains 1
- no new IndexedDB store
- no external Dataset upload
- no external AI API call
- existing subtitle editor input/preview/autosave remains the source of truth
