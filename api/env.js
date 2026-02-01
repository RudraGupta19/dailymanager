export default async function handler(req, res) {
  try {
    return res.json({
      SUPABASE_URL: process.env.SUPABASE_URL || "",
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || ""
    });
  } catch {
    return res.json({ SUPABASE_URL: "", SUPABASE_ANON_KEY: "" });
  }
}
