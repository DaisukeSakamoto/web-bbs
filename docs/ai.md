# v0.6.0 投稿要約・自動分類
新規スレッド投稿時にタイトル・本文を分析し、post_analysis テーブルに summary/category/source を保存。既存投稿・返信は変更しない。カテゴリ自動選択時のみ分類を投稿カテゴリに採用し、手動選択は維持。投稿削除で分析も連鎖削除。
既定は外部送信なしのキーワード分類（AI、IoT、技術、雑談）と160文字の本文抜粋。これは生成AIではない。
OpenAI利用時は環境変数 OPENAI_API_KEY、OPENAI_MODEL（既定 gpt-4.1-mini）、AI_MAX_DAILY（既定30）を設定。利用者が投稿ごとに明示同意した場合に限りタイトル・本文を外部送信。添付、削除キー、Cookieは送信しない。API失敗、8秒タイムアウト、不正応答、上限到達、同時処理中はローカルへフォールバック。上限はプロセス単位・UTC日単位で再起動時にリセットされるため厳密な課金制限ではない。API側でも予算管理を行う。AI生成結果は誤り得るためラベル表示し、投稿本文は改変しない。AI出力にツール実行権限はない。APIキーはGitやブラウザに公開しない。
Render: main、npm ci、npm start、PUBLIC_ORIGIN=https://実際のサービスURL、ヘルスチェック /healthz。OPENAI_API_KEY は任意。無料ディスクは非永続。有料永続ディスクを使う場合は DB_PATH をマウント配下に設定。Compose用バックアップはRenderでは自動起動しない。
GET /api/info はバージョンと外部AI有効フラグのみ返す。POST /api/threads は category=auto と aiConsent=true（JSON boolean）を受け付ける。通常読取APIの analysis は null または summary/category/source。
