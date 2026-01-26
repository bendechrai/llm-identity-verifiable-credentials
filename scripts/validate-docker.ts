/**
 * Static validation: checks that docker-compose.yaml volume mounts
 * are consistent with Dockerfile COPY destinations and WORKDIR.
 *
 * Exit codes: 0 = pass, 1 = validation error, 2 = parse error
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse as parseYaml } from "yaml";

// --- Types ---

interface ComposeService {
  build?: {
    context?: string;
    dockerfile?: string;
    args?: Record<string, string>;
  };
  volumes?: string[];
}

interface ComposeFile {
  services?: Record<string, ComposeService>;
}

// --- Dockerfile parsing ---

function resolveAbsolute(dest: string, currentWorkdir: string): string {
  if (dest.startsWith("/")) return dest.replace(/\/+$/, "");
  const clean = dest.replace(/^\.\//, "").replace(/\/+$/, "");
  return `${currentWorkdir.replace(/\/+$/, "")}/${clean}`;
}

/**
 * Build a map of absolute container paths from a Dockerfile's COPY + WORKDIR sequence.
 * Returns the resolved absolute destination for each COPY.
 */
function resolvedCopyDestinations(content: string, serviceArg?: string): string[] {
  const lines = content.split("\n");
  let currentWorkdir = "/";
  const destinations: string[] = [];

  for (const raw of lines) {
    const line = raw.trim();

    const wdMatch = line.match(/^WORKDIR\s+(\S+)/);
    if (wdMatch) {
      let dir = wdMatch[1];
      if (serviceArg) {
        dir = dir.replace(/\$\{SERVICE\}/g, serviceArg).replace(/\$SERVICE/g, serviceArg);
      }
      if (dir.startsWith("/")) {
        currentWorkdir = dir;
      } else {
        currentWorkdir = `${currentWorkdir.replace(/\/+$/, "")}/${dir}`;
      }
    }

    const copyMatch = line.match(/^COPY\s+(\S+)\s+(\S+)/);
    if (copyMatch) {
      const src = copyMatch[1];
      // Only track directory copies (source ends with /) since
      // bind mounts are always directories, not individual files.
      if (!src.endsWith("/")) continue;

      let dest = copyMatch[2];
      if (serviceArg) {
        dest = dest.replace(/\$\{SERVICE\}/g, serviceArg).replace(/\$SERVICE/g, serviceArg);
      }
      destinations.push(resolveAbsolute(dest, currentWorkdir));
    }
  }

  return destinations;
}

// --- Volume parsing ---

interface BindMount {
  host: string;
  container: string;
}

function parseBindMount(vol: string): BindMount | null {
  // Named volumes don't start with . or /
  if (!vol.startsWith("./") && !vol.startsWith("/")) return null;
  const parts = vol.split(":");
  if (parts.length < 2) return null;
  return {
    host: parts[0].replace(/\/+$/, ""),
    container: parts[1].replace(/\/+$/, ""),
  };
}

// --- Main ---

function validate(): number {
  const projectRoot = resolve(dirname(new URL(import.meta.url).pathname), "..");
  const composePath = resolve(projectRoot, "docker-compose.yaml");

  let composeContent: string;
  try {
    composeContent = readFileSync(composePath, "utf-8");
  } catch {
    console.error(`[ERROR] Cannot read ${composePath}`);
    return 2;
  }

  let compose: ComposeFile;
  try {
    compose = parseYaml(composeContent) as ComposeFile;
  } catch (e) {
    console.error(`[ERROR] Failed to parse docker-compose.yaml: ${e}`);
    return 2;
  }

  if (!compose.services) {
    console.error("[ERROR] No services found in docker-compose.yaml");
    return 2;
  }

  const dockerfileCache = new Map<string, string>();
  function readDockerfile(name: string): string | null {
    if (dockerfileCache.has(name)) return dockerfileCache.get(name)!;
    try {
      const content = readFileSync(resolve(projectRoot, name), "utf-8");
      dockerfileCache.set(name, content);
      return content;
    } catch {
      return null;
    }
  }

  let errors = 0;
  let checks = 0;

  console.log("Validating Docker configuration...\n");

  for (const [serviceName, service] of Object.entries(compose.services)) {
    // Skip services without a standard build (e.g., ralph)
    if (!service.build?.dockerfile) continue;

    const dockerfileName = service.build.dockerfile;

    // Skip ralph's Dockerfile — different structure entirely
    if (dockerfileName === "Dockerfile.ralph") continue;

    const serviceArg = service.build.args?.SERVICE;
    const dockerfileContent = readDockerfile(dockerfileName);

    if (!dockerfileContent) {
      console.error(`[ERROR] ${serviceName}: cannot read ${dockerfileName}`);
      errors++;
      continue;
    }

    const copyDests = resolvedCopyDestinations(dockerfileContent, serviceArg);
    const volumes = service.volumes ?? [];

    for (const vol of volumes) {
      const bind = parseBindMount(vol);
      if (!bind) continue; // skip named volumes

      checks++;

      const containerTarget = bind.container.replace(/\/+$/, "");

      // Exact match: the mount target is exactly a COPY destination.
      // We do NOT allow parent matches (e.g., mounting /app/src when
      // the Dockerfile copies to /app/src/vc-issuer) because that
      // hides sibling directories and flattens the path structure.
      const exactMatch = copyDests.some((dest) => dest === containerTarget);

      if (exactMatch) {
        console.log(`  [OK]   ${serviceName}: ${bind.host} -> ${bind.container}`);
      } else {
        console.error(
          `  [FAIL] ${serviceName}: volume mount targets ${bind.container} ` +
          `but no Dockerfile COPY destination matches. ` +
          `Expected one of: ${copyDests.join(", ")}`
        );
        errors++;
      }
    }
  }

  console.log("");
  if (errors > 0) {
    console.error(`${errors} validation error(s) found.`);
    return 1;
  }

  console.log(`All ${checks} bind-mount volume(s) validated successfully.`);
  return 0;
}

process.exit(validate());
