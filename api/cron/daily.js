import { createClient } from '@supabase/supabase-js';

function tzDateString(tz, days = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleString('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(500).json({ error: 'Missing Supabase service credentials' });
    const sb = createClient(url, key);
    const tz = process.env.LOCAL_TZ || 'UTC';
    const today = tzDateString(tz, 0);
    const yesterday = tzDateString(tz, -1);

    const { error: updErr } = await sb
      .from('tasks')
      .update({ date: today })
      .eq('date', yesterday)
      .eq('completed', false);
    if (updErr) return res.status(500).json({ error: 'Rollover failed' });

    return res.json({ ok: true, rolled_from: yesterday, rolled_to: today });
  } catch (e) {
    return res.status(500).json({ error: 'Cron failed' });
  }
}
