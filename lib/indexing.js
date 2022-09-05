import FormData from "form-data";
import { id_to_path, save_map_to_disk } from "./id_to_path.js";
import { hash24 } from "./hash24.js";

import Axios from "axios";
const axios = Axios.create({
  baseURL: process.env.IQDB_BASE_URL || "http://localhost:5588/",
});

/**
 * Indexes a file located at URL with IQDB
 * @param {BufferLike} file
 * @param {string} url
 */
export async function index(file, url) {
  const formdata = new FormData();
  formdata.append("file", file);
  const id = hash24(url);

  await axios.post(`/images/${id}`, formdata, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  id_to_path.set(id, url);

  save_map_to_disk();
}

import fs from "node:fs/promises";
import path from "path";

async function walk(pathname, walkFunc, dirent) {
  const _pass = (err) => err;

  let err;

  // special case: walk the very first file or folder
  if (!dirent) {
    let filename = path.basename(path.resolve(pathname));
    dirent = await fs.lstat(pathname).catch(_pass);
    if (dirent instanceof Error) {
      err = dirent;
    } else {
      dirent.name = filename;
    }
  }

  // run the user-supplied function and either skip, bail, or continue
  err = await walkFunc(err, pathname, dirent).catch(_pass);
  if (false === err) {
    // walkFunc can return false to skip
    return;
  }
  if (err instanceof Error) {
    // if walkFunc throws, we throw
    throw err;
  }

  // "walk does not follow symbolic links"
  // (doing so could cause infinite loops)
  if (!dirent.isDirectory()) {
    return;
  }
  let result = await fs.readdir(pathname, { withFileTypes: true }).catch(_pass);
  if (result instanceof Error) {
    // notify on directory read error
    return walkFunc(result, pathname, dirent);
  }
  for (let entity of result) {
    await walk(path.join(pathname, entity.name), walkFunc, entity);
  }
}

/**
 * Run through uploads folder and index files not present in the id_to_path map.
 */
export async function reindex_uploads() {
  const url_regex = /.*((original|big)\/.*)/;
  const ext_regex = /\.(jpe?g)$/;

  const uploads_folders = [
    process.env.UPLOADS_ORIGINAL_PATH + "original/",
    process.env.UPLOADS_ORIGINAL_PATH + "big/",
  ];

  console.log(`[info] starting reindexing uploads folders: ${uploads_folders}`);

  const walk_cb = async (err, path, dirent) => {
    if (err) {
      return false;
    }

    // For all image files
    if (dirent.isFile() && ext_regex.test(dirent.name)) {
      const url = url_regex.exec(path)[1];
      const id = hash24(url);

      // If the path hash isn't in the map, index it
      if (!id_to_path.has(id)) {
        try {
          const file = await fs.readFile(path);
          await index(file, url);
          console.log(`[info] indexed file ${url}`);
        } catch (e) {
          console.log(`[error] failed to index file ${url}:`, e);
        }
      }
    }
  };

  await Promise.all(uploads_folders.map((f) => walk(f, walk_cb)));

  console.log(`[info] finished indexing uploads folders: ${uploads_folders}`);
}
