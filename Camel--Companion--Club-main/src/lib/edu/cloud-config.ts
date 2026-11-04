/** Public configuration presence only; never logs keys or tokens. */
export function hasCloudConfiguration() {
  const url = import.meta.env["VITE_SUPABASE_URL"];
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  return Boolean(url && key && !url.includes("your-project") && !key.includes("your-publishable"));
}
