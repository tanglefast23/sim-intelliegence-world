# Save compatibility and recovery

## Version contract

Each authoritative state records the state schema, engine, content, prompt, model contract, model source revision, and GGUF SHA-256. The current state schema is version 5. A load fails closed when no registered migration can produce a valid current state.

## Migration contract

1. Read and validate the source without changing it.
2. Create a copy with a new generation ID.
3. Apply each registered migration in order.
4. Validate the complete current schema and invariants.
5. Write to a different target slot through the serialized save queue.
6. Keep the source slot byte-identical.

The Phase 14 fixture proves a version 1 to version 5 migration and an unsupported version 99 rejection. Both paths keep their source unchanged.

## Recovery contract

Every slot uses a main file, a temporary candidate, a backup, and ordered autosaves in one app-owned directory. Writes are serialized, flushed, read back, schema-checked, checksum-checked, and then replaced on the same volume. Startup selects the newest complete generation, not the newest modification time. Corrupt candidates stay available for diagnosis.

The fault suite covers interruption after each save stage, forced process death, disk full, permission failure, corrupt candidates, stale lineage, generation order, backup promotion, migration, and slot traversal.

## Player-facing failure

An unavailable migration does not overwrite the old save. The load result states that the save is incompatible. A future release must add a tested migration or ask the player to use the earlier game version. It must not guess missing state.
