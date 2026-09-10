# Persistence

Characters persist template snapshot, level, XP, currency, map/position/direction, HP/MP, inventory JSON and equipment JSON. The new world fields are a schema baseline; no client endpoint currently mutates them. Battle and idle state are existing server-owned persistence flows. Online movement must remain in memory/Redis and be flushed on autosave, map transition, disconnect and graceful shutdown—not per input frame.
