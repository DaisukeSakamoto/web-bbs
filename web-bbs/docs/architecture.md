# 構成
Browser (HTML/CSS/JS) -> HTTPS reverse proxy (本番で追加) -> Express :8000 -> node:sqlite (WAL, foreign keys ON)

posts: id (PK AUTOINCREMENT), parent (nullable FK posts.id ON DELETE CASCADE), title, body, owner_hash, created. parent NULL はスレッド、非NULLは返信。返信先はスレッドのみ。同期SQLiteなので大規模負荷には不向き。公開前に管理機能と運用対策を追加する。
