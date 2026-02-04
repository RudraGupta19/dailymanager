import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let client = null;
let url = window.SUPABASE_URL || "";
let key = window.SUPABASE_ANON_KEY || "";
async function ensureClient() {
  if (client) return client;
  if (!url || !key) {
    try {
      const r = await fetch('/api/env');
      const j = await r.json();
      url = j.SUPABASE_URL || url;
      key = j.SUPABASE_ANON_KEY || key;
    } catch {}
  }
  if (url && key) client = createClient(url, key);
  return client;
}

async function loadTasks() {
  await ensureClient();
  if (!client) return [];
  const { data } = await client.from("tasks").select("id,title,date,notes,completed");
  return Array.isArray(data) ? data : [];
}

async function saveAll(tasks) {
  await ensureClient();
  if (!client) return;
  const rows = tasks.map(t => ({ id: t.id, title: t.title, date: t.date, notes: t.notes || null, completed: !!t.completed }));
  if (rows.length === 0) return;
  const { error } = await client.from("tasks").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

async function deleteTask(id) {
  await ensureClient();
  if (!client) return;
  const { error } = await client.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

async function loadLater() {
  await ensureClient();
  if (!client) return [];
  const { data } = await client.from("later").select("id,title,notes");
  return Array.isArray(data) ? data : [];
}

async function saveLater(items) {
  await ensureClient();
  if (!client) return;
  const rows = items.map(x => ({ id: x.id, title: x.title, notes: x.notes || null }));
  if (rows.length === 0) return;
  const { error } = await client.from("later").upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

window.sb = { client, loadTasks, saveAll, deleteTask, loadLater, saveLater };
