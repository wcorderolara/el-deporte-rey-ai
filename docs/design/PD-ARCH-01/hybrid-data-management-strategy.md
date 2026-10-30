# Hybrid Data Management Strategy

## Local operational source of truth

Generation reads a frozen, validated local selection. Provider APIs are used only on an explicit operator sync action, never as a side effect of requesting generation. Imported values are proposals to update local records, not direct provider-owned truth.

Each sourced field/value should retain (directly or through a versioned observation): source kind (`manual`, provider-neutral adapter, or other approved source), source reference, observed/synchronized time, local update time, verification state, and whether an operator override is active. This metadata is internal and is not a claim that imported data is independently verified.

## Explicit synchronization

1. Operator selects competition, season, stage/round and resource scope to sync.
2. Adapter maps provider payload into provider-neutral validated records and opaque source references.
3. A synchronization record captures scope, source, start/end, outcome and safe conflict counts.
4. Compare incoming values to last accepted imported baseline and current local values.
5. Apply only new/non-conflicting imported fields. Never silently replace a manual override or a locally edited field.
6. Show proposed conflicts with current value, incoming value and provenance; operator chooses whether to retain local or accept incoming. Keep prior values in history.
7. Revalidate the resulting local state and mark any dependent standings/results incomplete or stale where needed.

No provider payload, source URL, credential or provider-specific identifier leaks into content prompts or public contracts. External identifiers are stored behind a source binding/reference map.

## Manual edits and conflicts

- Manual changes set an explicit override marker and retain the previous value/provenance in version history.
- A later sync does not overwrite an override. It records a conflict proposal and keeps current local data until an explicit decision.
- If the local field still equals the prior imported baseline, an accepted sync may update it automatically within the operator-selected scope.
- If provider sources disagree, preserve each observation and apply source trust/verification rules; do not silently choose the most recent score.
- A conflict resolution records who/when/action and the source values involved (single local operator today, audit shape still retained).

## Validation and completeness

- Enforce unique participants and match identity within the correct competition/season/stage context.
- A match must reference teams participating in that context; home and away team cannot be identical.
- Scores are non-negative integers within configured bounds and only exist for compatible terminal result states. Missing scores remain missing.
- A finished match with incomplete score is invalid for result content. A scheduled match may legitimately have no result.
- Standings require an explicit ranking basis and all required results for the selected scope; otherwise expose availability as unavailable/incomplete, never derive fictional rows.
- Special/knockout formats may use ties/legs and advancement rules; do not assume round robin or one matchday number sequence.
- Content generation captures exactly the chosen local records and their version identifiers. A later sync does not mutate an already generated content snapshot.

## Current limitations

PD-ARCH-01A has no source bindings, local teams, sync history or sports records. The current version stores only a managed competition name and timestamps; it does not claim that the competition has verified sports data.
