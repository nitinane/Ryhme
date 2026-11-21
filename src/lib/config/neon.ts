type NeonIdentity = { host: string; database: string; role: string };

export function neonDevelopmentUrls(env: Record<string, string | undefined>, expected: NeonIdentity) {
  const { host, database, role } = expected;
  if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(host)
    || host.split(".")[0].endsWith("-pooler") || !database || !role) {
    throw new Error("Supply the direct endpoint hostname, database name, and role from the development branch in Neon Console.");
  }
  const pooledHost = host.replace(".", "-pooler.");
  return (["DATABASE_URL", "DIRECT_URL"] as const).map((key) => {
    const url = URL.parse(env[key] ?? "");
    const expectedHost = key === "DATABASE_URL" ? pooledHost : host;
    if (!url || !["postgresql:", "postgres:"].includes(url.protocol) || url.hostname !== expectedHost
      || (url.port && url.port !== "5432") || !url.password || url.hash
      || url.pathname !== `/${encodeURIComponent(database)}` || url.username !== encodeURIComponent(role)
      || [...url.searchParams.keys()].some((name) => !["sslmode", "channel_binding"].includes(name))
      || url.searchParams.getAll("sslmode").length !== 1
      || !["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")
      || url.searchParams.getAll("channel_binding").length > 1
      || (url.searchParams.has("channel_binding") && url.searchParams.get("channel_binding") !== "require")) {
      throw new Error(`${key} does not match the expected Neon development identity and secure connection settings.`);
    }
    url.searchParams.set("sslmode", "verify-full");
    return { key, url: url.href };
  });
}
