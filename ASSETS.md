# 内蚊 — アセット台帳

| Asset | 目的 | 生成プロンプト要約 | URL | 利用予定 |
|---|---|---|---|---|
| Visual target | ゲーム全体の画作りの基準 | 9:16、夏の和室、眠る人物、蚊、線香、招き猫、木版画絵本調 | `/manus-storage/naika-visual-target_9416951e.png` | デザイン参照 |
| Room background | 背景の主プレート | 9:16、畳・障子・縁側・簾・風鈴・夜空、中央を空ける | `/manus-storage/naika-room-background_d0c50701.png` | タイトル・ゲーム背景 |
| Character / mosquito sheet | 人物4段階と敵3種の下絵 | 3/4見下ろし、健康〜萎み、蚊3種、クロマキー背景 | `/manus-storage/naika-character-mosquitoes_4f20809d.png` | 人物・敵の参照／切り出し元 |
| Defense item sheet | 4アイテムとコインの下絵 | 線香、招き猫、蛙、達磨、コイン、クロマキー背景 | `/manus-storage/naika-defense-items_9bd6ed22.png` | アイテムの参照／切り出し元 |
| Brand mark | ロゴ・favicon | 蚊取り線香の渦、羽、軒先を読む抽象記号 | `/manus-storage/naika-mark_1621aaa0.png` | ヘッダ・favicon |
| Night defense loop | BGM | 92 BPM、D minor、箏・控えめな太鼓・尺八・鈴・夏夜の室内音、75秒で自然にループする設計 | `/manus-storage/naika-night-defense-loop_0b454f3f.mp3` | 開始操作後のゲーム中BGM |

生成物は必ず使用前に、透過、輪郭、反復可能性、背景とのコントラストを確認する。現行プロトタイプでは、背景とロゴを直接利用し、人物・敵・道具は同一の色・シルエット指針に従ってBabylonの軽量図形として実装している。生成BGMはブラウザの自動再生制約を守るため、ユーザーの開始操作後にだけ再生する。
