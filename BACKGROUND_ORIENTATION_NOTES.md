# Background Orientation Notes

- 朝・夜の背景元画像はいずれも、窓・屋外景色が上、畳が下となる正しい縦構図で保存されている。
- ユーザー指定により、ホーム画面・ゲームプレイ画面ともに背景を180度回転して表示する。
- 今後の背景表示は、CSSの `rotate(180deg)` とBabylon背景テクスチャの `uScale`・`vScale` 反転を併用する。
