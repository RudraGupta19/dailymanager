import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const url = window.SUPABASE_URL || "";
const key = window.SUPABASE_ANON_KEY || "";
let client = null;
if (url && key) client = createClient(url, key);

async function loadTasks() {
  if (!client) return [];
  const { data } = await client.from("tasks").select("id,title,date,notes,completed");
  return Array.isArray(data) ? data : [];
}

async function saveAll(tasks) {
  if (!client) return;
  const rows = tasks.map(t => ({ id: t.id, title: t.title, date: t.date, notes: t.notes || null, completed: !!t.completed }));
  if (rows.length === 0) return;
  await client.from("tasks").upsert(rows, { onConflict: "id" });
}

async function deleteTask(id) {
  if (!client) return;
  await client.from("tasks").delete().eq("id", id);
}

async function loadLater() {
  if (!client) return [];
  const { data } = await client.from("later").select("id,title,notes");
  return Array.isArray(data) ? data : [];
}

async function saveLater(items) {
  if (!client) return;
  const rows = items.map(x => ({ id: x.id, title: x.title, notes: x.notes || null }));
  if (rows.length === 0) return;
  await client.from("later").upsert(rows, { onConflict: "id" });
}

window.sb = { client, loadTasks, saveAll, deleteTask, loadLater, saveLater };
