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
  save_map_to_disk,
} from "./lib/id_to_path.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import { get_photo_from_path } from "./lib/db.js";

const kSCORE_THRESHOLD = process.env.SCORE_THRESHOLD || 60;
app.post("/query", upload.single("file"), async (req, res) => {
  if (!("file" in req)) return res.status(400).send();

  try {
    const formdata = new FormData();
    formdata.append("file", req.file.buffer);
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
      .filter((p) => p.score > kSCORE_THRESHOLD && p.score < 98)
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

  const quit = () => {
    server.close();
    save_map_to_disk();
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
