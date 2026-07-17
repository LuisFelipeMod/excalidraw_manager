// Sincronização com o Google Drive (espelho: local -> Drive).
//
// O filesystem local é a fonte da verdade; aqui apenas empurramos (push) o
// conteúdo para o Drive. Usa o escopo drive.file, então só enxergamos os
// arquivos/pastas que o próprio app criou.
//
// Estrutura no Drive: uma pasta raiz "Nanquim" espelhando a hierarquia local.
// O mapeamento caminho-relativo -> fileId fica em userData/drive-index.json.

const { app, net } = require("electron");
const path = require("path");
const fsp = require("fs").promises;
const googleAuth = require("./googleAuth");

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "Nanquim";
const INDEX_FILE = path.join(app.getPath("userData"), "drive-index.json");

// ---- índice (caminho relativo -> fileId) -------------------------------

let cache = null;

async function loadIndex() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fsp.readFile(INDEX_FILE, "utf8"));
  } catch {
    cache = {};
  }
  cache.folders ||= {}; // caminho relativo da pasta -> folderId
  cache.files ||= {}; // caminho relativo do arquivo -> { fileId, syncedAt }
  return cache;
}

async function saveIndex(index) {
  cache = index;
  await fsp.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), "utf8");
}

// ---- chamadas à API ----------------------------------------------------

async function apiFetch(url, opts = {}) {
  const token = await googleAuth.getAccessToken();
  const res = await net.fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Drive API ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function createFolder(name, parentId) {
  const metadata = { name, mimeType: FOLDER_MIME };
  if (parentId) metadata.parents = [parentId];
  const res = await apiFetch(`${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  return res.id;
}

/** Garante a pasta raiz "Nanquim" no Drive (reaproveita se já existir). */
async function ensureRoot(index) {
  if (index.rootFolderId) return index.rootFolderId;
  const q = `name='${ROOT_FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const found = await apiFetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`,
  );
  const id = found.files?.[0]?.id ?? (await createFolder(ROOT_FOLDER_NAME, null));
  index.rootFolderId = id;
  await saveIndex(index);
  return id;
}

/** Garante toda a cadeia de pastas de um caminho relativo, retornando o id da última. */
async function ensureFolderPath(index, relDir, rootId) {
  let parentId = rootId;
  let acc = "";
  for (const seg of relDir.split("/")) {
    acc = acc ? `${acc}/${seg}` : seg;
    if (index.folders[acc]) {
      parentId = index.folders[acc];
      continue;
    }
    parentId = await createFolder(seg, parentId);
    index.folders[acc] = parentId;
  }
  await saveIndex(index);
  return parentId;
}

function mimeFor(name) {
  return name.endsWith(".md") ? "text/markdown" : "application/json";
}

/** Cria um arquivo novo (metadados + conteúdo) via upload multipart. */
async function createFile(name, parentId, content, mime) {
  const boundary = "nanquim" + Math.random().toString(36).slice(2);
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify({ name, parents: [parentId] })}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mime}; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;
  const res = await apiFetch(
    `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  return res.id;
}

/** Atualiza o conteúdo de um arquivo existente. */
async function updateContent(fileId, content, mime) {
  await apiFetch(`${DRIVE_UPLOAD}/files/${fileId}?uploadType=media&fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": `${mime}; charset=UTF-8` },
    body: content,
  });
  return fileId;
}

/**
 * Empurra um documento local para o Drive (cria ou atualiza). `relPath` usa
 * "/" como separador (mesmo formato dos caminhos do renderer).
 */
async function pushFile(relPath, content) {
  const index = await loadIndex();
  const rootId = await ensureRoot(index);

  const dir = path.posix.dirname(relPath);
  const parentId =
    dir === "." || dir === ""
      ? rootId
      : await ensureFolderPath(index, dir, rootId);
  const name = path.posix.basename(relPath);
  const mime = mimeFor(name);

  let fileId = index.files[relPath]?.fileId;
  if (fileId) {
    try {
      await updateContent(fileId, content, mime);
    } catch (err) {
      // arquivo removido/lixeira no Drive: recria do zero
      if (err.status === 404) fileId = null;
      else throw err;
    }
  }
  if (!fileId) fileId = await createFile(name, parentId, content, mime);

  index.files[relPath] = { fileId, syncedAt: Date.now() };
  await saveIndex(index);
  return { fileId };
}

module.exports = { pushFile };
