# 添付ファイル設計 v0.4.0
投稿・返信のJSONに任意の attachment: {name,mime,base64} を含める。1投稿1ファイル、5 MiB、JSON上限7 MiB、他APIは32 KiB。圧縮HTTPリクエストは拒否。ファイル名に制御文字・パス区切りを許可しない。名前は保存パスに使用しない。PNGは拡張子、宣言MIME、署名、チャンクCRC、サイズ、展開長を検証。8bit RGB/RGBA非インターレースのみ、最大4096px/辺・400万画素。再エンコードでメタデータを除去、最大320pxサムネイルを生成。TXTは厳密UTF-8と制御文字を検証しダウンロード専用。その他は拒否。画像処理は同期・単一プロセス想定。
SQLite attachments にBLOB保存、投稿作成と同一トランザクション。論理容量100 MiB（サムネイル含む）、DBファイル/WALの実ディスクサイズ上限ではない。投稿削除時は外部キーで連鎖削除、管理者は添付だけを削除可能。SQLiteの空きページは再利用されるが即時物理消去を保証しない。
GET /api/attachments/:id/download は application/octet-stream と Content-Disposition attachment、GET /api/attachments/:id/thumbnail は再生成PNGのみ。どちらも公開投稿と同じ公開範囲。DELETE /api/admin/attachments/:id は管理者認証・Origin・JSON必須。投稿規制中は添付付き投稿も拒否。添付が含まれる投稿の通常APIにはメタ情報のみを返す。
制約: JPEG/GIF/WebP/PDF/Office/ZIP、複数添付、マルウェアスキャン、利用者別容量、画像内容審査は未対応。公開運用にはプロキシの本文制限・タイムアウト、ディスク監視、バックアップ、利用規約が必要。添付は公開情報なので個人情報や機密を投稿しないこと。
