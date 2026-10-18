'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント（フロントエンド用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type WatchedUrl = {
  id: string;
  url: string;
  title: string | null;
  is_active: boolean;
  last_checked_at: string | null;
};

export default function Home() {
  const [urls, setUrls] = useState<WatchedUrl[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. 登録済みURLの一覧を取得
  const fetchUrls = async () => {
    const { data, error } = await supabase
      .from('watched_urls')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUrls(data);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, []);

  // 2. 新しいURLを追加
  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl) return;

    setLoading(true);
    const { error } = await supabase
      .from('watched_urls')
      .insert([{ url: newUrl }]);

    setLoading(false);
    if (error) {
      alert('追加に失敗しました: ' + error.message);
    } else {
      setNewUrl('');
      fetchUrls();
    }
  };

  // 3. URLを削除
  const handleDelete = async (id: string) => {
    if (!confirm('このURLの監視を解除しますか？')) return;

    const { error } = await supabase
      .from('watched_urls')
      .delete()
      .eq('id', id);

    if (!error) {
      fetchUrls();
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6 font-sans">
      <h1 className="text-2xl font-bold mb-6">🌐 サイト更新検知ダッシュボード</h1>

      {/* URL追加フォーム */}
      <form onSubmit={handleAddUrl} className="flex gap-2 mb-8">
        <input
          type="url"
          placeholder="監視したいURLを入力 (例: https://example.com)"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          required
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? '追加中...' : '追加'}
        </button>
      </form>

      {/* 登録済みURL一覧 */}
      <h2 className="text-lg font-semibold mb-3">監視中のサイト一覧</h2>
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        {urls.length === 0 ? (
          <p className="p-4 text-gray-500 text-center">監視中のURLはまだありません。</p>
        ) : (
          <ul className="divide-y">
            {urls.map((item) => (
              <li key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="truncate flex-1 mr-4">
                  <p className="font-medium text-blue-600 truncate">{item.title || 'タイトル取得待ち...'}</p>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:underline truncate block">
                    {item.url}
                  </a>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">
                    最終チェック: {item.last_checked_at ? new Date(item.last_checked_at).toLocaleString('ja-JP') : '未実行'}
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}