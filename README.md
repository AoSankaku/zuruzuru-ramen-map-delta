# ZURUZURU RAMEN MAP DELTA

SUSURU TV.に登場した店舗を地図と一覧から探す、非公式ファンサイトです。店舗名・住所・動画はYouTube動画の概要欄をもとに生成します。

## 開発

```bash
bun install
bun run dev
```

## 直近300動画から店舗データを更新する

Google CloudでYouTube Data API v3を有効化し、APIキーを環境変数へ設定します。Uploadsプレイリストをページングするため、高コストなSearch APIは使いません。

PowerShell:

```powershell
$secureKey = Read-Host "YouTube API key" -AsSecureString
$env:YOUTUBE_API_KEY = [System.Net.NetworkCredential]::new("", $secureKey).Password
Remove-Variable secureKey

bun run sync:data
```

`sync:data` は以下を順番に実行します。

1. 直近300動画と公開状態を `src/data/youtube-videos.generated.json` へ取得
2. 概要欄の店舗名・住所・店舗掲載URLを抽出し、同一店舗の複数訪問を統合
3. 国土地理院の住所検索APIで国内住所を座標へ変換し、海外住所はOpenStreetMap Nominatimで補完
4. HeartRails Expressで国内店舗の最寄り駅を取得し、駅座標との距離から概算徒歩分数を算出
5. `src/data/shops.generated.json` と確認用レポートを生成

動画を再取得せず、保存済みの動画から店舗データだけ再生成する場合は `bun run build:shops` を使います。座標は `src/data/geocoding-cache.json`、最寄り駅は `src/data/station-cache.json` に保存され、再実行時に再利用されます。海外住所の検索はNominatimの利用方針に合わせて1秒1回未満・直列・キャッシュ付きです。解決できなかった住所・駅は `src/data/shop-import-report.generated.json` で確認できます。

保存済み動画の公開状態だけを再確認する場合:

```powershell
bun run check:youtube
bun run build:shops
```

`videos.list` の応答に存在しない動画は `unavailable` とし、店舗の登場回数・注目度から除外します。API自体が失敗した場合は既存ファイルを書き換えません。

## 注記

- 本プロジェクトは非公式ファンサイトであり、SUSURU TV.および関係者とは一切関係ありません。
- 営業状況は自動判定していません。閉店・移転・海外店舗を除外しない方針ですが、未確認情報は `unknown` として扱います。
- 評価値は味の採点ではなく、公開動画の視聴回数と登場回数から算出する「注目度」です。
- 徒歩分数は経路検索結果ではありません。駅と店舗の座標間距離に道路迂回係数1.2を掛け、80m/分で切り上げた概算です。
- 最寄り駅データはHeartRails Expressを利用しています。
- OpenStreetMap標準タイルを公開運用で使う場合は、想定トラフィックに対応したタイル事業者を選定してください。
