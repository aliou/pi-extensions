/**
 * Catalog scanner. Discovers skills and packages from an npm registry.
 *
 * Uses the npm search API to list all packages in a scope, then fetches
 * metadata for group packages to resolve their constituent skills.
 */

export interface CatalogEntry {
  type: "skill" | "package";
  name: string; // unscoped: "frontend", "biome"
  npmRef: string; // "npm:@agents/frontend"
  description: string;
  skills?: string[]; // packages only: ["biome", "tailwind", ...]
}

interface SearchHit {
  package: {
    name: string;
    description: string;
    keywords?: string[];
  };
}

interface SearchResponse {
  objects: SearchHit[];
  total: number;
}

interface PackageMetadata {
  "dist-tags": Record<string, string>;
  versions: Record<string, { dependencies?: Record<string, string> }>;
}

/** Fetch all packages from the npm registry search API with pagination. */
async function searchAll(
  registry: string,
  scope: string,
): Promise<SearchHit[]> {
  const hits: SearchHit[] = [];
  const size = 50;
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const url = `${registry}/-/v1/search?text=${encodeURIComponent(scope)}&size=${size}&from=${from}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Registry search failed: ${res.status} ${res.statusText}`,
      );
    }

    const json = await res.json();
    const data = json as SearchResponse;
    hits.push(...data.objects);

    if (hits.length >= data.total) break;
    from += size;
  }

  return hits;
}

/** Fetch metadata for a single package to get its dependencies. */
async function fetchPackageMetadata(
  registry: string,
  scope: string,
  name: string,
): Promise<PackageMetadata | null> {
  const encoded = `${scope}%2f${name}`;
  const url = `${registry}/${encoded}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    return json as PackageMetadata;
  } catch (_error) {
    void _error;
    return null;
  }
}

/** Classify a search hit as skill or package based on keywords. */
function classifyEntry(
  hit: SearchHit,
  scope: string,
): CatalogEntry & { type: "skill" | "package" } {
  const keywords = hit.package.keywords ?? [];
  const isPackage = keywords.includes("pi-package");
  const name = hit.package.name;

  return {
    type: isPackage ? "package" : "skill",
    name,
    npmRef: `npm:${scope}/${name}`,
    description: hit.package.description ?? "",
  };
}

/** Scan an npm registry for all packages in a scope. */
export async function scanRegistry(
  registry: string,
  scope: string,
): Promise<CatalogEntry[]> {
  const hits = await searchAll(registry, scope);
  const entries = hits.map((hit) => classifyEntry(hit, scope));

  // Fetch metadata for group packages to resolve constituent skills
  const packages = entries.filter((e) => e.type === "package");
  const metadataResults = await Promise.all(
    packages.map(async (pkg) => {
      const meta = await fetchPackageMetadata(registry, scope, pkg.name);
      return { pkg, meta };
    }),
  );

  for (const { pkg, meta } of metadataResults) {
    if (!meta) continue;
    const latest = meta["dist-tags"]?.latest;
    if (!latest) continue;
    const version = meta.versions?.[latest];
    if (!version?.dependencies) continue;

    const skillNames = Object.keys(version.dependencies)
      .filter((dep) => dep.startsWith(`${scope}/`))
      .map((dep) => dep.slice(scope.length + 1));

    if (skillNames.length > 0) {
      pkg.skills = skillNames;
    }
  }

  return entries;
}
