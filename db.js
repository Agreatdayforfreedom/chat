// const sqlite3 = require("sqlite3").verbose();
import sqlite3 from "sqlite3";
import { open } from "sqlite";
const filepath = "./chat.db";
// const db = new sqlite.Database(filepath);
async function createDbConnection() {
  //   db.serialize(async() => {
  sqlite3.verbose();
  const db = await open({
    filename: filepath,
    driver: sqlite3.Database,
  });

  await db.run(
    `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(32) NOT NULL,
        avatar VARCHAR(255) NOT NULL, 
        created_at INT NOT NULL
      )`
  );

  await db.run(
    `CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_1 INTEGER NOT NULL,
        member_2 INTEGER NOT NULL,
        FOREIGN KEY(member_1) REFERENCES users(id),
        FOREIGN KEY(member_1) REFERENCES users(id)
    )`
  );

  await db.run(
    `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content VARCHAR(255) NOT NULL,
        room INTEGER NOT NULL,
        emitter INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(room) REFERENCES rooms(id),
        FOREIGN KEY(emitter) REFERENCES users(id)
    )`
  );

  const m = await db.get(`
        SELECT * FROM messages
 `);
  const res = await db.get(
    `SELECT 
        r.id AS room_id,
        u.id AS member_1_id,
        u.name AS member_1_name,
        u.avatar AS member_1_avatar,
        u2.id AS member_2_id,
        u2.name AS member_2_name,
        u2.avatar AS member_2_avatar
        FROM rooms r 
            LEFT JOIN users u ON u.id =r.member_1 
            LEFT JOIN users u2 ON u2.id =r.member_2
    `
  );

  return db;
}
// function createDbConnection() {
//   const db = new sqlite.Database(filepath, (error) => {
//     if (error) {
//       return console.error(error.message);
//     }

//     test(db);
//   });
//   console.log("Connection with SQLite has been established");
//   return db;
// }
// async function test(db) {
//   db.exec(`
//     CREATE TABLE sharks
//     (
//       ID INTEGER PRIMARY KEY AUTOINCREMENT,
//       name   VARCHAR(50) NOT NULL,
//       color   VARCHAR(50) NOT NULL,
//       weight INTEGER NOT NULL
//     );
//   `);
//   const res = db.exec(`SELECT * FROM sharks;`);
//   console.log({ res });
// }

export default createDbConnection;
