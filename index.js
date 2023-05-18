/**
 * obj = {
 *  room: {}
 * }
 *
 *
 *
 *
 *
 */

import { createServer } from "http";
import staticHandler from "serve-handler";
import express, { text } from "express";
import ws, { WebSocketServer } from "ws";
import superagent from "superagent";
import { nanoid } from "nanoid";
import Redis from "ioredis";
import { Level } from "level";
import JSONStream from "JSONStream";
import cors from "cors";
import qs from "query-string";
import { format } from "./helpers/queryToJson.js";

import { isAuth, isAuthHttp } from "./auth.js";
import createDbConnection from "./db.js";
const db = await createDbConnection();

// import sqlite3 from "sqlite3";
// const filepath = "./chat.db";
// const sqlite = sqlite3.verbose();
// const db = new sqlite.Database(filepath);

const redisClient = new Redis();
const redisClientXRead = new Redis();
const app = express();
const server = createServer(app, (req, res) => {
  return staticHandler(req, res, { public: "www" });
});

app.use(cors());
app.use(express.json());
app.use(express.static("www"));
// const db = new Level("chat", { valueEncoding: "json" });

let users = [];
let rooms = {};

app.post("/login", async (req, res) => {
  let exists = await db.get(`SELECT * FROM users WHERE name=?`, req.body.user);
  if (exists) return res.json({ data: exists });
  let result = await db.run(
    `INSERT INTO users(name, avatar, created_at) VALUES(:name,:avatar,:created_at)`,
    {
      ":name": req.body.user,
      ":avatar": `https://secure.gravatar.com/avatar/${Math.floor(
        Math.random() * 1000
      )}?s=90&d=identicon`,
      ":created_at": +new Date(),
    }
  );

  if (result.lastID) {
    const user = await db.get(
      "SELECT * FROM users WHERE id = ?",
      result.lastID
    );
    if (user) return res.json({ data: user });
  }
});

app.get("/rooms", isAuthHttp, async (req, res) => {
  console.log(req.user, "USEEEEEEEER");
  const all = await db.all(
    `SELECT 
          r.id AS id,
          u.id AS member_1foreign_id,
          u.name AS member_1_name,
          u.avatar AS member_1_avatar,
          u2.id AS member_2foreign_id,
          u2.name AS member_2_name,
          u2.avatar AS member_2_avatar
          FROM rooms r 
          LEFT JOIN users u ON u.id =r.member_1 
          LEFT JOIN users u2 ON u2.id =r.member_2
          WHERE r.member_1 = :user OR r.member_2= :user
      `,
    { ":user": req.user }
  );
  let formatted = format(all);
  res.json({ data: formatted });
});

app.get("/messages/:room", isAuthHttp, processMessages);

app.get("/users", async (_req, res) => {
  const users = await db.all("SELECT * FROM users");
  res.send(users);
});

const wss = new WebSocketServer({ server });

wss.getUniqueID = function () {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + "-" + s4();
};
wss.on("connection", async (ws, request) => {
  const users = await redisClient.smembers("users");
  const auth_ws_client = request.headers["sec-websocket-protocol"];
  //todo: when tab is closed, the user status is not set to offline
  if (users) ws.send(JSON.stringify({ type: "users", data: users }));
  const val = isAuth(request, ws);
  if (!val) return; //maybe retrieve the current connections?
  broadcastConnection(request, ws, "online");
  ws.on("message", async (msg) => {
    const obj = JSON.parse(msg);
    console.log(obj);
    const { type } = obj;
    switch (type) {
      case "join":
        const room = obj["room"] ? obj.room : nanoid(); //todo: find existing room
        join(obj.from, obj.to, room, ws);
        processStreamMessages(room, auth_ws_client, ws).catch((err) =>
          console.error(err)
        );
        break;
      case "leave":
        leave(params);
        break;
      case "message":
        const chat = Object.entries(rooms[obj.room]);
        let date = +new Date();
        console.log(chat);
        for (const [, sock] of chat) {
          // console.log(
          //   sock === ws,
          //   "-----------------------------------------------------------------------------"
          // );
          sock.send(
            JSON.stringify({
              type: "message",
              data: [
                JSON.stringify({
                  emitter: obj.emitter,
                  content: obj.content,
                  created_at: date,
                }),
              ],
              room: obj.room,
            })
          );
        }
        try {
          redisClient.xadd(
            obj.room,
            "*",
            "content",
            obj.content,
            "emitter",
            obj.emitter,
            "created_at",
            date
          );
          // processStreamMessages(obj.roomroom, obj.from, ws).catch();
        } catch (error) {
          console.log(error);
          break;
        }
        break;
      default:
        console.warn(`Type: ${type} unknown`);
        break;
    }
  });

  ws.on("close", () => {
    console.log(request.user + "disconnected");
    broadcastConnection(request, ws, "offline");
  });
});
async function join(from, to, room, client) {
  //todo: attach info user to the room member
  console.log("joining", from, to, room);

  const roomExists = await db.get(`SELECT * FROM rooms WHERE id=?`, room);
  if (roomExists) {
    if (!rooms[room]) rooms[room] = {};
    if (!rooms[room][from]) rooms[room][from] = {};
    if (rooms[room][from] === client) return;
    if (rooms[room]) {
      rooms[room][from] = client;
    }
    return;
  }
  let query_info = `SELECT * FROM users WHERE id=?`;
  const member_1_info = await db.get(query_info, from);
  const member_2_info = await db.get(query_info, to);
  if (!member_1_info || !member_2_info) throw new Error("There was a error");
  //open for first time a chat
  if (!rooms[room]) rooms[room] = {};
  if (!room[from]) rooms[room][from] = {};
  if (rooms[room][from] === client) return;
  if (rooms[room]) {
    rooms[room][from] = client;
    rooms[room][to] = ""; // set second member as empty to validate later
  }
  await db.run(
    `INSERT INTO rooms(member_1, member_2) VALUES(?, ?)
    `,
    member_1_info.id,
    member_2_info.id
  );
}

function leave(ws) {}
async function broadcastConnection(req, wsclient, status) {
  if (status === "online") {
    Promise.all([
      await redisClient.sadd(
        "users",
        JSON.stringify({ type: "status", status, user: req.user })
      ),
      await redisClient.srem(
        "users",
        JSON.stringify({ type: "status", status: "offline", user: req.user })
      ),
    ]);
  } else if (status === "offline") {
    Promise.all([
      await redisClient.sadd(
        "users",
        JSON.stringify({ type: "status", status, user: req.user })
      ),
      await redisClient.srem(
        "users",
        JSON.stringify({ type: "status", status: "online", user: req.user })
      ),
    ]);
  }
  // process.nextTick(async () => {
  //   wsclient.send(JSON.stringify(await redisClient.smembers("users")));
  //   console.log("sent");
  // });

  for (const client of wss.clients) {
    // if (status === "offline" && wsclient === client) {
    //   client.close();
    // }
    if (client.readyState === ws.OPEN) {
      client.send(
        JSON.stringify([
          { type: "users" },
          JSON.stringify({ type: "status", status, user: req.user }),
        ])
      );
    }
  }
}
function broadcast(msg) {
  for (const client of wss.clients) {
    if (client.readyState === wss.OPEN) {
      client.send(JSON.stringify(msg));
    }
  }
}

let lastRecordId = "$";
//prettier-ignore
async function processStreamMessages(stream, user, ws) {
  let messages = [];

  // console.log('----------s')
  try {
    
    
    const [[, records_chat]] = await redisClientXRead.xread(
      "STREAMS",
      stream,
      0
    );
    console.log(records_chat)
  if (records_chat.length > 0) for (const [id, data] of records_chat) {
      var multi = data.reduce((a, c, i) => {
        return i % 2 === 0 ? a.concat([data.slice(i, i + 2)]) : a;
      }, []);
      let obj = Object.fromEntries(multi);
      
      messages.push(JSON.stringify(obj));
      console.log(obj.emitter, user)
      if(obj.emitter !== user) { 
        console.log("inserting...")
        await Promise.all([
          await db.run(`
            INSERT INTO messages(content, room, emitter, created_at)
              VALUES (?, ?, ?, ?)
          `, obj.content,stream, obj.emitter, +new Date),
          await redisClientXRead.xdel(stream, id),
        ]).catch(err=>console.log(err));
      };
  }
} catch (error) {
  console.log(error)
  return
}
  
  if (messages.length > 0) {
    console.log("sending queue to: "+user, messages);
    ws.send(JSON.stringify({ type: "message", data: messages }));
  }
}

async function processMessages(request, response) {
  const { room } = request.params;
  const messages = await db.all(
    "SELECT * FROM messages WHERE room=?",
    parseInt(room)
  );
  console.log(messages);
  response.json({ type: "message", data: messages });
}

server.listen(process.argv[2] || 8080, () =>
  console.log("server on port 8080")
);
