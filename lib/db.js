import mariadb from "mariadb";
import sqlstring from "sqlstring";

const pool = mariadb.createPool({
  host: process.env.LYCHEE_DB_HOST,
  port: process.env.LYCHEE_DB_PORT,
  user: process.env.LYCHEE_DB_USER,
  database: process.env.LYCHEE_DB_NAME,
  password: process.env.LYCHEE_DB_PASS,
  connectionLimit: 5,
});

export let conn;

async function init() {
  conn = await pool.getConnection();
}

export async function get_photo_from_path(path) {
  if (typeof path !== "string") throw new TypeError();

  const photo_id = (
    await conn.query(
      `SELECT photo_id from size_variants WHERE short_path=${sqlstring.escape(
        path
      )}`
    )
  )[0].photo_id;

  const album_id =
    "#" +
    ((
      await conn.query(
        `SELECT album_id from photos WHERE id=${sqlstring.escape(photo_id)}`
      )
    )[0].album_id || "unsorted") +
    "/";

  return (process.env.LYCHEE_PREFIX || "") + album_id + photo_id;
}

init();
