# 内蚊 — アセット台帳

| Asset | 目的 | 生成プロンプト要約 | URL | 利用予定 |
|---|---|---|---|---|
| Visual target | ゲーム全体の画作りの基準 | 9:16、夏の和室、眠る人物、蚊、線香、招き猫、木版画絵本調 | `/manus-storage/naika-visual-target_9416951e.png` | デザイン参照 |
| Room background | 背景の主プレート | 9:16、畳・障子・縁側・簾・風鈴・夜空、中央を空ける | `/manus-storage/naika-room-background_d0c50701.png` | タイトル・ゲーム背景 |
| Character / mosquito sheet | 人物4段階と敵3種の下絵 | 3/4見下ろし、健康〜萎み、蚊3種、クロマキー背景 | `/manus-storage/naika-character-mosquitoes_4f20809d.png` | 人物・敵の参照／切り出し元 |
| Defense item sheet | 4アイテムとコインの下絵 | 線香、招き猫、蛙、達磨、コイン、クロマキー背景 | `/manus-storage/naika-defense-items_9bd6ed22.png` | アイテムの参照／切り出し元 |
| Brand mark | ロゴ・favicon | 蚊取り線香の渦、羽、軒先を読む抽象記号 | `/manus-storage/naika-mark_1621aaa0.png` | ヘッダ・favicon |
| Night defense loop | BGM | 92 BPM、D minor、箏・控えめな太鼓・尺八・鈴・夏夜の室内音、75秒で自然にループする設計 | `/manus-storage/naika-night-defense-loop_0b454f3f.mp3` | 開始操作後のゲーム中BGM |
| Common mosquito sprite | 通常敵 | 小型の黒炭色の蚊、月白の羽、行灯橙の微光 | `/manus-storage/naika-mosquito-small-sprite_af4952dd.png` | 通常敵の描画 |
| Fast mosquito sprite | 高速敵 | 細身の紺黒の蚊、後ろへ流れる羽、橙の腹部線 | `/manus-storage/naika-mosquito-fast-sprite_f65f8e38.png` | 高速敵の描画 |
| Sturdy mosquito sprite | 強敵 | 太い墨黒の胴、広い藍の羽、朱印の印 | `/manus-storage/naika-mosquito-sturdy-sprite_87f8df86.png` | 強敵の描画 |
| Defense item atlas | 道具の2x2スプライト | 線香、招き猫、蛙、達磨を木版画調で統一 | `/manus-storage/naika-defense-items-atlas_4c991078.png` | 道具トレイ・設置物の描画 |
| Woodblock VFX atlas | 命中・撃破・落下・被弾の2x2VFX | 墨線、橙朱の印影、煙、ダメージ印 | `/manus-storage/naika-woodblock-vfx-atlas_9cc67c3a.png` | 画面内の短時間VFX |
| 3D defense atlas | 防衛アイテムの2x2スプライト | 線香、招き猫、カエル、ダルマを釉薬・漆・湿潤素材で描いた3Dデジタル調 | `/manus-storage/naika-3d-defense-atlas_d5b41c2f.png` | アイテムトレイ・設置アイテム |
| 3D koban | 通貨スプライト | 打ち出し金属と行灯橙の反射を持つ小判 | `/manus-storage/naika-3d-koban_5621d1b0.png` | ドロップ小判・価格マーク |
| 3D insect atlas | 敵スプライト | 月光の半透明羽と光沢ある胴を持つ3種の3D飛翔昆虫 | `/manus-storage/naika-3d-insect-atlas_425b7f3c.png` | 通常敵・高速敵・強敵 |
| Koban collect SFX | 回収操作音 | 金属のチャリンと金色の余韻を持つ短尺効果音 | `/manus-storage/naika-koban-collect_c76439e0.mp3` | 小判をタップして回収した時 |
| Item place SFX | 設置操作音 | 漆器の着地、陶器のクリック、行灯のきらめきを持つ短尺効果音 | `/manus-storage/naika-item-place_c23e24d7.mp3` | 防衛アイテムを畳に設置した時 |

生成物は必ず使用前に、透過、輪郭、反復可能性、背景とのコントラストを確認する。現行プロトタイプでは、背景とロゴを直接利用し、人物・敵・道具は同一の色・シルエット指針に従ってBabylonの軽量図形として実装している。生成BGMはブラウザの自動再生制約を守るため、ユーザーの開始操作後にだけ再生する。
