import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(500).json({ error: 'Supabase service credentials missing' });
    const sb = createClient(url, key);
    if (req.method === 'GET') {
      const { data, error } = await sb.from('later').select('id,title,notes');
      if (error) return res.status(500).json({ error: 'Failed to read later' });
      return res.json({ tasks: data || [] });
    }
    if (req.method === 'POST') {
      const { tasks } = req.body || {};
      if (!Array.isArray(tasks)) return res.status(400).json({ error: 'Invalid tasks' });
      const rows = tasks.map(t => ({ id: t.id, title: t.title, notes: t.notes || null }));
      const { error } = await sb.from('later').upsert(rows, { onConflict: 'id' });
      if (error) return res.status(500).json({ error: 'Failed to upsert later' });
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}
