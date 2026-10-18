import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

// Supabase クライアントの初期化
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// SHA-256ハッシュ生成関数
function generateHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// サイトの巡回＆メインテキスト抽出処理
async function fetchMainContent(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    // ノイズ（広告、ヘッダー、フッター、スクリプトなど）を除去
    $('script, style, noscript, header, footer, nav, iframe, .ad, .ads, .banner, .side-bar').remove();

    // メインコンテンツのテキストを抽出 (mainタグ、articleタグ、またはbody全体)
    let mainText = $('main').text() || $('article').text() || $('body').text();

    // 余白や改行を整理
    mainText = mainText.replace(/\s+/g, ' ').trim();

    const pageTitle = $('title').text().trim() || url;

    return { title: pageTitle, text: mainText };
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return null;
  }
}

// Discord Webhook 通知関数
async function sendDiscordNotification(title: string, url: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL!;
  if (!webhookUrl) return;

  const payload = {
    embeds: [
      {
        title: `🔔 サイトの更新を検知しました！`,
        description: `**[${title}](${url})** の内容が更新されました。`,
        color: 3066993, // エメラルドグリーン
        fields: [
          { name: '対象URL', value: url }
        ],
        timestamp: new Date().toISOString()
      }
    ]
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// 定期巡回用 API エンドポイント (Vercel Cron から呼ばれる)
export async function GET() {
  // 1. 監視対象のURLを取得
  const { data: urls, error } = await supabase
    .from('watched_urls')
    .select('*')
    .eq('is_active', true);

  if (error || !urls) {
    return NextResponse.json({ error: 'Failed to fetch URLs' }, { status: 500 });
  }

  // 2. 各URLを巡回してチェック
  for (const item of urls) {
    const content = await fetchMainContent(item.url);
    if (!content || !content.text) continue;

    const currentHash = generateHash(content.text);

    // 初回登録時、またはハッシュ値に変更があった場合
    if (!item.last_hash) {
      // 初回はハッシュ値だけ登録
      await supabase
        .from('watched_urls')
        .update({ last_hash: currentHash, title: content.title, last_checked_at: new Date() })
        .eq('id', item.id);
    } else if (item.last_hash !== currentHash) {
      // 更新あり！ Discord通知 ＆ DB更新
      await sendDiscordNotification(content.title, item.url);

      await supabase
        .from('watched_urls')
        .update({ last_hash: currentHash, title: content.title, last_checked_at: new Date() })
        .eq('id', item.id);
    } else {
      // 変更なし：最終チェック時間のみ更新
      await supabase
        .from('watched_urls')
        .update({ last_checked_at: new Date() })
        .eq('id', item.id);
    }
  }

  return NextResponse.json({ success: true, checkedCount: urls.length });
}