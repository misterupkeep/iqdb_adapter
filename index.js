import express from "express";

// multipart encoding express middleware
import FormData from "form-data";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

// promise-based HTTP client -- makes code a lot cleaner than node:http
import Axios from "axios";
const axios = Axios.create({
  baseURL: process.env.IQDB_BASE_URL || "http://localhost:5588/",
});

/**
 * ID-to-path hash map and serialization functions.
 */
import {
  id_to_path,
  read_map_from_disk,
  save_map_to_disk_immediate,
} from "./lib/id_to_path.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import fs from "node:fs/promises";
import { get_photo_from_path } from "./lib/db.js";

const url_regex = /uploads\/(.*)/;
const kSCORE_THRESHOLD = process.env.SCORE_THRESHOLD || 15;
const kSCORE_THRESHOLD_MAX = process.env.SCORE_THRESHOLD_MAX || 70;
app.post("/query", async (req, res) => {
  if (!("file" in req.body) || typeof req.body.file !== "string")
    return res.status(400).send();

  try {
    const filepath =
      process.env.UPLOADS_ORIGINAL_PATH + url_regex.exec(req.body.file)[1];
    const file = await fs.readFile(filepath);

    const formdata = new FormData();
    formdata.append("file", file);
    let upstream_res = (
      await axios.post(`/query`, formdata, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })
    ).data;

    let posts = [];
    await Promise.all(
      upstream_res.map(async (e) => {
        if (id_to_path.has(e.post_id)) {
          const path = id_to_path.get(e.post_id);
          const href = await get_photo_from_path(path);
          posts.push({
            url: (process.env.LYCHEE_PREFIX || "") + "uploads/" + path,
            href,
            score: e.score,
          });
        }
      })
    );
    posts = posts
      .filter(
        (p) => p.score > kSCORE_THRESHOLD && p.score < kSCORE_THRESHOLD_MAX
      )
      .sort((a, b) => b.score - a.score);

    if (posts.length % 3 == 1) posts.pop();

    res.json(posts).send();
  } catch (e) {
    console.log("[error] query failed:", e);
    res.status(500).send();
  }
});

import { reindex_uploads } from "./lib/indexing.js";

async function main() {
  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => {
    console.log(`[info] IQDB wrapper listening on port ${port}`);
  });

  const quit = async () => {
    server.close();
    await save_map_to_disk_immediate();
    process.exit(0);
  };

  process.on("SIGTERM", quit);
  process.on("SIGINT", quit);

  try {
    await read_map_from_disk();
  } finally {
    const kREINDEX_INTERVAL =
      process.env.REINDEX_INTERVAL || 1.5 * 60 * 60 * 1000;
    await reindex_uploads();
    setInterval(reindex_uploads, kREINDEX_INTERVAL);
  }
}

main();
