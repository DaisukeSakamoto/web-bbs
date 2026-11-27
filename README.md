# web-bbs v0.3.0
Node.js 22.16以上 + Express 5 + SQLite（node:sqlite）による匿名掲示板。日本語UI、投稿・返信・検索・削除キー。アカウント不要。

## ローカル起動
```sh
npm install
npm test
npm start
```
http://localhost:8000 を開く。別のホスト名やポートを使う場合は PUBLIC_ORIGIN と PORT を設定する。

## Docker
```sh
docker compose up --build -d
docker compose logs -f
docker compose down
```
名前付きボリューム bbs-data にDBを保存。`down -v` はデータを消すため注意。初期設定ではホストのループバックのみ公開。

## API
| method | path | JSON / query |
|---|---|---|
| GET | /api/threads | q（任意） |
| GET | /api/thread-pages | q, category, page（任意） |
| GET | /api/threads/:id | なし |
| POST | /api/threads | title, body, category（任意） |
| POST | /api/threads/:id/comments | body |
| DELETE | /api/posts/:id | deleteToken |
変更系は Content-Type: application/json と PUBLIC_ORIGIN に一致する Origin が必要。投稿成功時のみ削除キーを返す。スレッドを削除すると返信も消える。検索は部分一致、最新100件、返信は先頭500件まで。旧一覧APIは互換性のため維持。新一覧APIは20件ずつ表示。

## 設定
PORT=8000、DB_PATH=data/bbs.sqlite、PUBLIC_ORIGIN=http://localhost:8000。DockerではDB_PATHが /app/data/bbs.sqlite。

## GitHub公開
GitHubで空の public リポジトリ web-bbs を作成（README等の自動生成なし）。このディレクトリで実行：
```sh
git init -b main
git add .
git commit -m "Initial anonymous BBS implementation"
git remote add origin https://github.com/DaisukeSakamoto/web-bbs.git
git push -u origin main
```
GitHub CLI が認証済みなら代わりに `gh repo create web-bbs --public --source=. --remote=origin --push` （commitまで実行した後、remote追加前）。認証情報はGit Credential Managerまたはgh auth loginで管理し、ソースに書かない。

## 検証状況
Node v22.16.0でDBテスト2件合格。npm registryへのDNS接続不可によりExpressの導入・HTTPテスト未実施。Dockerも実行環境なし。依存ロックファイルは未生成、npm install後に生成された package-lock.json をコミットし、CIとDockerを npm ci に変更すること。

## 公開運用前の課題
HTTPS、管理者による削除・通報、利用規約、プライバシーポリシー、バックアップと復元試験、監視、プロキシ設定とレート制限、依存関係の監査を追加する。現状は開発用MVP。公開リポジトリとインターネットへのサービス公開は別。ライセンスは未指定のため付与していない。

## v0.2.0
カテゴリ general / technology / ai / iot、検索とカテゴリの併用、20件単位のページング。既存DBは起動時に category 列を追加し既存投稿を general とする。更新前にDBをバックアップすること。新APIは items, total, page, pageSize を返す。旧APIは維持。追加テストはCIで確認する。

## v0.3.0 管理機能
`ADMIN_PASSWORD` に20〜256文字の十分に強いランダムな秘密を環境変数で設定して起動する。未設定・短い場合は管理機能が無効。http://localhost:8000/admin.html でログイン。Docker Composeにも環境変数を渡す。秘密をGitに登録しない。管理者セッションは1時間・再起動で失効。通報、削除、対応済み処理、全体の新規投稿と返信の一時停止・再開、操作履歴を追加。既存DBは起動時に追加テーブルを作成するため事前に停止してバックアップする。公開運用ではHTTPSと適切なプロキシ設定が必要。詳細は docs/moderation.md。今回のテスト結果はCIで確認する。
