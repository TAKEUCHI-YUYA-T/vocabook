# アプリに同梱するデータの元（Markdown）

Google スプレッドシートは使いません。このフォルダの Markdown を直して、変換スクリプトを実行します。

| ファイル | 内容 | 変換 |
|---|---|---|
| `tips.md` | ホームの「今日のヒント」 | `node scripts/build-presets.js` → `assets/presets/tips.json` |
| `ing-or-to.md` | ing or to の問題 | 同上 → `assets/presets/ing-or-to.json` |
| `default-words/*.md` | 既定の単語（品詞ごと。TOEIC 対策の範囲。アプリでは未使用） | 同上 → `assets/presets/default-words.json` |
| `words/*.md` | 自分の単語（品詞ごと。個人のデータ） | `node scripts/words-md-to-csv.js` → アプリの「取り込み」で読める CSV |

`words/` は個人のデータなので、git の対象外です（`.gitignore`）。`default-words/` は、アプリに同梱して配るので、git で管理します。

### 既定の単語について
- **いまは、アプリでは使っていません**（新規インストールは、空の単語帳から始まります。アプリに追加する操作もありません）。内容の記録として、置いています。
- アプリに組み込むときは、`assets/presets/default-words.json`（`node scripts/build-presets.js` で作る）を読みます。
- `default-words/*.md` は、自分の単語（`words/`）から選んで作ったものです（`node scripts/build-default-words.js`。一度だけ使う）。以後は、`default-words/` を直接直します。
- 公開して配るので、意味が空・品詞名そのもの・重複・綴りミスは入れません（テストが確かめます）。

## 書き方

### ヒント（`tips.md`）
`## タイトル` の下に、本文を書きます。空行や改行は、そのまま表示されます。

```
## 関係代名詞

whichかthatで悩んだ場合、…
```

### ing or to の問題（`ing-or-to.md`）
`## 単語` の下に、`- 項目名: 値` を並べます。空の項目は書きません。

```
## avoid

- 答え: ～ing
- 意味: ～することを避ける
- 例文: Please avoid making noise.（騒ぐのを避けてください）
- 補足: 補足があれば
```

- 項目は、`答え`（`～ing` か `to～`）・`意味`・`例文`・`補足` です。
- 答えが意味によって変わる動詞は、同じ単語を2つ書きます（remember、stop など）。
- 値が複数行のときは、2行目からは、先頭に空白を2つ付けます。

### 単語（`words/*.md`）
ファイル名が品詞です（`noun.md`、`verb.md`、`adverb.md`、`adjective.md`、`preposition.md`、`conjunction.md`、`auxiliaryVerb.md`、`idiom.md`）。
項目は、`意味`・`例文`・`例文の訳`・`メモ`（ing or to の問題にも出すなら `ing or to`）です。`default-words/` も同じ書き方です。
単語が2行にわたる場合は、`- 単語の続き:` に2行目以降を書きます。

## 反映のしかた
1. Markdown を直します。
2. `node scripts/build-presets.js` を実行します（ヒントと ing or to）。
3. `npx jest` を実行します（Markdown と `assets/presets` が食い違っていないか確かめます）。
4. commit して、アプリを更新します（EAS Update か、ビルド）。

内容が変わると、`assets/presets/version.json` の版が変わり、アプリは次の起動でヒントと問題を入れ直します。
