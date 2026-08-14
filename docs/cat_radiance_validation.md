# 招き猫の穏やかな光粒：確認記録

招き猫の誘引確認画面（`?visual-check=1&item=cat&item-hold=1&cat-lure-check=1`）で、設置済みの有効範囲リングは表示されず、招き猫の周囲から小さな金色の光粒だけが穏やかに放射することを確認した。

実行時DOMは、`lastActivation: cat:trigger`、`catRadiance: 1`、`catMotes: 9`、`persistentRanges: 0`、`previewRanges: 0` を返した。招き猫の実際の誘引効果に連動し、設置済みアイテムの範囲表示を復活させずに光粒だけを描画している。
