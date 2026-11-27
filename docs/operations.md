# 運用手順 v0.5.0
## ローカル
npm ci / npm test / npm start。PUBLIC_ORIGIN はブラウザの正確なオリジン。ADMIN_PASSWORD は強いランダム値を環境変数に設定。Dockerの通常構成は127.0.0.1:8000のみ公開。
## HTTPS
Docker Compose v2.24.4以上（!reset対応）。実際のドメインをDNS設定し、信頼できるCAの fullchain.pem / privkey.pem を certs/ に配置。秘密鍵をGitに登録しない。PUBLIC_ORIGIN=https://実際のドメイン と ADMIN_PASSWORD を設定し、docker compose -f compose.yaml -f compose.https.yaml up --build -d を実行。80/443を開放し8000を外部公開しない。証明書発行・更新は外部ACMEクライアント等で行い、更新後 nginx -s reload（docker compose exec nginx nginx -s reload、同じ-f指定）。自己署名証明書は検証用のみ。単一ドメイン想定。TRUST_PROXY=1 はこの隔離構成だけで使う。Nginxは受信X-Forwarded-Forを上書きする。
## バックアップ
backupコンテナが起動直後と24時間ごとにオンラインスナップショットを作成し、成功した最新7世代を bbs-backups に保存。BACKUP_INTERVAL_SECONDS、BACKUP_RETAINで変更。SQLite backup APIでWAL整合性を維持し integrity_check / foreign_key_check を検証する。手動: docker compose exec backup node src/maintenance.js backup （スケジュールと重ならないよう注意）。一覧: docker compose exec backup ls -l /app/backups。別ボリュームでも同一ホスト障害には弱いので暗号化した外部コピーを別途保存。バックアップに削除キーハッシュや投稿が含まれるので公開しない。
## 復元
必ず停止してから実施。docker compose stop nginx bbs backup（通常構成では nginx を除く）。docker compose run --rm --no-deps backup node src/maintenance.js restore /app/backups/実際のファイル名.sqlite --offline 。--offline は操作者の確認でありプロセス検出ではない。WAL/SHM/journalが残る場合は拒否。削除せず原因を確認し正常なSQLite停止・チェックポイントを実施する。現DBの退避ファイルを作成してから同一ディレクトリ内で置換する。復元後 docker compose up -d、healthzと投稿・添付を確認。HTTPS運用中はすべて同じ-f指定。ローカルはサーバー停止後 npm run backup / npm run restore -- backups/ファイル.sqlite --offline。バックアップを同じDBに上書きしない。
## 監視
GET /healthz はDB応答とディスク空き容量を検査。200正常、503異常。MIN_FREE_BYTES既定256 MiB。60秒ごとに disk_ok/disk_low をJSONログ出力。低容量は警告とヘルス異常であり自動投稿停止や自動復旧ではない。docker compose ps / logs --tail=100 bbs backup。Docker JSONログは10MB×3にローテーション。アプリのアクセスログに本文・URL・IP・Cookieは含めない。Nginxエラーログやインフラログは別途保護。バックアップ失敗は backup_failed を監視。外部通知、オフサイト自動転送、証明書自動更新は未実装。バックアップボリュームとホスト空き容量も運用側で監視。
