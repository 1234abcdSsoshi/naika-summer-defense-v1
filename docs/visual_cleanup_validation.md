# 蚊・小判の装飾削除：可視確認記録

## 実画面確認

最終コードで `/?visual-check=1&demo=1&inspect=1&reward=1` を開き、playing phaseを縦長390×844pxで確認した。画面には中央付近に蚊、左側に小判が同時に描画され、いずれにも周囲へ落ちるCSSドロップシャドウは見られなかった。小判の右上にあった丸い補助ハイライトも描画されていない。

## DOM・CSS確認

`GameCanvas.tsx` の小判DOMは、可視の小判本体に加えていた空の `<i />` 要素を含まない。最終定義の `.enemy-dom` と `.koban-dom` はいずれも `filter: none` であり、小判は `box-shadow: none` である。蚊の飛行キーフレームも明度変化のみで、`drop-shadow`を使わない。

## 自動回帰確認

`client/src/components/GameCanvas.visual.test.ts` により、小判上の丸い要素がマークアップに存在しないこと、最終スタイルに蚊・小判のドロップシャドウがないことを検証する。

## 下層Babylon描画の除去

添付画像で確認された暗い重なりは、DOMオーバーレイの背後に残っていたBabylon側の蚊シルエット・スプライトおよび小判ディスクだった。蚊・小判の各`TransformNode`を`setEnabled(false)`にし、描画はDOMオーバーレイだけに一本化した。確認用画面で蚊と小判を同時に表示し、背後の重なりが消えたことを確認した。

確認用画面のDOM検証では、`.enemy-dom`と`.koban-dom`がともに存在し、小判の`box-shadow`は`none`、小判内の丸い補助要素は0件だった。蚊・小判に残る`filter`は移動演出中の明度変化のみで、CSSドロップシャドウは含まれない。
