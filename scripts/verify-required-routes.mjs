import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(root, ".smac-required-routes.json");

function safePath(rel) {
  if (typeof rel !== "string" || !rel || rel.includes("\0")) {
    throw new Error(`잘못된 필수 파일 경로: ${String(rel)}`);
  }
  const absolute = resolve(root, rel);
  const fromRoot = relative(root, absolute);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(`사이트 폴더 밖을 가리키는 경로: ${rel}`);
  }
  return absolute;
}

if (!existsSync(manifestPath)) {
  throw new Error(`필수 페이지 목록이 없습니다: ${manifestPath}`);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const routes = Array.isArray(manifest.requiredRoutes) ? manifest.requiredRoutes : [];
if (routes.length === 0) {
  throw new Error("requiredRoutes가 비어 있습니다.");
}

const errors = [];
for (const item of routes) {
  const files = [item.file, ...(Array.isArray(item.assets) ? item.assets : [])];
  for (const rel of files) {
    let absolute;
    try {
      absolute = safePath(rel);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (!existsSync(absolute) || !statSync(absolute).isFile()) {
      errors.push(`${item.route}: 배포 파일 누락 ${rel}`);
    }
  }
  if (item.contains && existsSync(safePath(item.file))) {
    const html = readFileSync(safePath(item.file), "utf8");
    if (!html.includes(item.contains)) {
      errors.push(`${item.route}: 본문 확인 문구 누락 ${item.contains}`);
    }
  }
}

if (errors.length) {
  console.error(errors.map((value) => `- ${value}`).join("\n"));
  process.exit(1);
}

console.log(`필수 공개 경로 ${routes.length}개와 연결 파일을 확인했습니다.`);
