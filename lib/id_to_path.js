import fs from "node:fs/promises";

/**
 * Map hash24 IDs into image URLs. Used to look up IDs into URLs returned from
 * the IQDB query.
 */
export let id_to_path = new Map();

function debounce(func, timeout = 1000) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(() => {
        resolve(func.apply(this, args));
      }, timeout);
    });
  };
}

export const save_map_to_disk_immediate = () => {
  console.log(
    `[info] writing id_to_path map to disk with ${id_to_path.size} entries`
  );

  return fs.writeFile(
    process.env.INDEX_FILE || "/data/.indexed",
    JSON.stringify(Array.from(id_to_path.entries())),
    { encoding: "utf-8" }
  );
};

export const save_map_to_disk = debounce(save_map_to_disk_immediate);

/**
 * Reads id_to_path map from file on disk. Will overwrite the current map!
 */
export async function read_map_from_disk() {
  try {
    const map = await fs.readFile(process.env.INDEX_FILE || "/data/.indexed", {
      encoding: "utf-8",
    });
    id_to_path = new Map(JSON.parse(map));
    console.log(
      `[info] read id_to_path map from disk with ${id_to_path.size} entries`
    );
  } catch (e) {
    // Reading the file failed, so set id_to_path to an empty map
    console.log(`[warn] reading id_to_path map from disk failed:`, e);
    id_to_path = new Map();
  }
}
