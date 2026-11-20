const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const envContent = fs.readFileSync(".env", "utf8");
const urlMatch = envContent.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: cargos, error: errC } = await supabase.from("cargos").select("id, origin, destination, total_tonnage, status").limit(5);
  console.log("Cargos error:", errC, "Cargos:", cargos);
  const { data: shipments, error: errS } = await supabase.from("shipments").select("id, cargo_id, status, loaded_tonnage").limit(5);
  console.log("Shipments error:", errS, "Shipments:", shipments);
}
run();
