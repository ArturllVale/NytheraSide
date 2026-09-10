# Content pipeline

`tools/content-sync` normalizes RPG Maker JSON and imports a draft. Publishing creates an immutable numbered `ContentVersion` and replaces the active pointer. Client compatibility currently checks the active version endpoint but does not yet enforce a local content hash; perform first MV validation manually.
