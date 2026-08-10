# Save compatibility and recovery

## Version contract

Each authoritative state records the state schema, engine, content, prompt, model contract, model source revision, GGUF SHA-256, and a layout revision for each map. The current state schema is version 6. The loader accepts complete version 5 and version 6 envelopes only. A load fails closed when no registered migration can produce a valid current state.

## Migration contract

1. Read and validate the source without changing it.
2. Create a copy. A load-time migration keeps the save lineage ID. An explicit slot-copy migration uses the requested new generation ID.
3. Apply each registered state migration in order.
4. Run deterministic layout recovery against the packaged compiled map catalog.
5. Validate the complete current schema and invariants.
6. Write one new version 6 generation through the serialized save queue.
7. Keep the selected legacy source as the byte-identical backup.

The Phase 20 fixtures include a real version 5 envelope with its version-aware checksum and a real version 6 envelope with stale layout revisions. Tests prove version 1 to version 6 slot-copy migration, version 5 load-time migration, stale version 6 layout migration, and unsupported-version rejection.

## Layout recovery contract

Missing, zero, or lower map revisions start recovery before a state is returned. Recovery uses stable location bindings, interaction approaches, and portal IDs. It processes the protagonist first and then NPCs in stable ID order. It uses north, west, east, south breadth-first search and a claimed-actor set. Ordinary actors cannot move onto portal, staging, or interaction-approach cells.

Recovery updates no source object and no map revision until every affected field succeeds. A missing portal, missing binding, newer save layout, or missing valid tile returns `unrecoverable` with reason `layout_migration_failed`. The loader does not choose an older generation after the newest supported generation fails layout recovery.

## Recovery contract

Every slot uses a main file, temporary candidates, a backup, and ordered autosaves in one app-owned directory. The loader classifies every candidate as supported, incompatible, or corrupt before it selects the newest complete generation. It does not use modification time. Corrupt and incompatible candidates stay available for diagnosis.

Writes are serialized, flushed, read back, schema-checked, checksum-checked, and then replaced on the same volume. The first post-migration save uses the same queue and fault stages as an ordinary save.

The fault suite covers interruption after each save stage, forced process death, disk full, permission failure, partial temporary files, corrupt candidates, incompatible candidates, stale lineage, generation order, backup promotion, load-time migration, slot-copy migration, and slot traversal.

## Player-facing failure

The load API returns one typed result: `empty`, `unchanged`, `migrated`, `incompatible`, `corrupt`, or `unrecoverable`. No failure overwrites the old save. A future release must add a tested migration or ask the player to use the earlier game version. It must not guess missing state.
