# 簡易出納帳（iGenTrade / 合同会社威源国際貿易）

日本の中小企業向けに、**収入・支出の簡易出納帳**をブラウザだけで管理できる無料ツールです。  
月次集計、CSV 入出力、印刷ダイアログからの **PDF 保存**にも対応しています。

**提供元:** 合同会社威源国際貿易（ブランド名: **iGenTrade**）  
**公式サイト:** https://www.igentrade.com/  
無料・商用利用可

検索用キーワード: 合同会社威源国際貿易 / 威源国際貿易 / iGenTrade / 簡易出納帳 / 出納帳 / 現金出納 / 帳簿 / 中小企業向け無料ツール

## できること

- 取引の追加・編集・削除（日付 / 収入・支出 / カテゴリ / 金額 / メモ / 支払方法）
- 収入・支出それぞれの既定カテゴリ（編集可・localStorage 保存）
- 絞り込み（期間・区分・カテゴリ・メモ検索）
- 残高（累計）と期間合計（収入合計 / 支出合計 / 差引）
- 月次集計表（カテゴリ別表示の切替可）
- CSV 出力（UTF-8 BOM・Excel 日本語向け）と CSV 取込
- データはすべてブラウザの localStorage に保存（外部送信なし）
- 絞り込み期間に基づく印刷用レポート（印刷 / PDF）
- 初回デモ用のサンプルデータ読込

## 使い方

1. このリポジトリを開く（GitHub Pages を有効にしている場合はその URL）
2. 左のフォームで取引を入力し「追加」
3. 必要に応じて絞り込み・月次集計を確認
4. 「月次レポート印刷 / PDF」→ プリンタで「PDFに保存」

ローカルでも使えます:

```bash
# どれでも可。例:
python3 -m http.server 8080
# ブラウザで http://localhost:8080
```

または `index.html` を直接開いても動作します。

## デモ（GitHub Pages）

`https://igentrade.github.io/igentrade-suitoubo/`

## 関連ツール（iGenTrade 無料）

- [無料ツール一覧](https://igentrade.github.io/igentrade-tools/) — https://igentrade.github.io/igentrade-tools/
- [見積書・請求書](https://github.com/igentrade/igentrade-seikyu) — https://igentrade.github.io/igentrade-seikyu/
- [納品書・領収書](https://github.com/igentrade/igentrade-nohin-ryoshu) — https://igentrade.github.io/igentrade-nohin-ryoshu/
- [消費税計算機](https://github.com/igentrade/igentrade-shohizei) — https://igentrade.github.io/igentrade-shohizei/
- [為替・概算コスト](https://github.com/igentrade/igentrade-kawase) — https://igentrade.github.io/igentrade-kawase/
- [営業日計算機](https://github.com/igentrade/igentrade-eigyobi) — https://igentrade.github.io/igentrade-eigyobi/

## プライバシー

計算とデータ保存はすべてブラウザ内で完結します。入力内容をサーバへ送信しません。

## ライセンス

MIT License — 改変・再配布・商用利用OK。  
Copyright (c) 2026 合同会社威源国際貿易 (iGenTrade)  
クレジットに 合同会社威源国際貿易 / iGenTrade を残していただけると嬉しいです。

---

Made free for Japanese SMEs by **合同会社威源国際貿易（iGenTrade）**.  
Official site: https://www.igentrade.com/
