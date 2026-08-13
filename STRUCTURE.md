# 内蚊 — 実装構造

React は画面枠、Babylon はキャンバス、`client/src/game` はフレームワーク非依存のゲーム本体とする。

```text
client/src/components/GameCanvas.tsx  # Engineの生成・破棄・resize、DOM HUD、BGM開始制御
client/src/game/scene.ts              # createGameScene、GameWorld、入力、敵・コイン・道具・スコア
client/src/index.css                  # 藍夜／行灯橙の縦型和室UIとタイトル用シグナル
docs/naika_game_launch_document.md    # 競合調査、ゲーム企画、要件、KPI、運用設計
ASSETS.md                             # 生成画像・BGM・利用URLの台帳
```

現行プロトタイプでは、`GameWorld` がBabylonノードと状態を所有し、ReactはUIとエンジンのライフサイクルだけを扱う。重要な不変条件は、ゲーム状態が `Playing` 以外の時にシミュレーションを進めないこと、キャンバスへのポインタ入力をdispose時に必ず解除すること、開始ユーザー操作後のみBGMを再生することの3点である。
