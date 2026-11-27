# 管理・通報設計 v0.3.0
- POST /api/posts/:id/report: 匿名で理由（1〜500文字）を通報。一般の変更系レート制限対象。
- POST /api/admin/login: password、成功時Cookie発行。
- GET /api/admin/dashboard: 投稿・未対応通報件数と最新100件、操作履歴。
- DELETE /api/admin/posts/:id: 投稿削除。スレッド削除は返信・関連通報も連鎖削除。
- POST /api/admin/reports/:id/resolve: 通報を対応済みに変更。
- PUT /api/admin/settings: paused (boolean)。新規投稿と返信のみ全体停止、閲覧・通報・削除は可能。
- POST /api/admin/logout: セッション無効化。
管理者操作の削除、対応、停止変更をSQLiteに記録。削除した投稿本文・通報内容は監査ログに保存しない。個別IPのBAN、複数管理者、監査ログの耐改ざん、通報重複排除は未実装。単一プロセス想定。最新100件以外はID指定で削除可能。公開前に運用規約とバックアップを整える。
