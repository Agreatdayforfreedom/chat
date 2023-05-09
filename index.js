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
import express from "express";
import ws, { WebSocketServer } from "ws";
import superagent from "superagent";
import { nanoid } from "nanoid";
import Redis from "ioredis";
import { Level } from "level";
import JSONStream from "JSONStream";
import cors from "cors";
import qs from "query-string";
import { isAuth, isAuthHttp } from "./auth.js";

const redisClient = new Redis();
const redisClientXRead = new Redis();
const app = express();
const server = createServer(app, (req, res) => {
  return staticHandler(req, res, { public: "www" });
});

app.use(cors());
app.use(express.json());
app.use(express.static("www"));
const db = new Level("chat", { valueEncoding: "json" });
let users = [];
let rooms = {};

// app.get("/", (req, res) => {});

app.post("/login", (req, res) => {
  const exists = users.find((user) => user === req.body.user);
  if (exists) return res.send("User already exists");

  users.push(req.body.user);
  return res.send(req.body);
});

app.get("/rooms", isAuthHttp, async (_req, res) => {
  try {
    let roomsdb = {};
    console.log(_req.user, "u");
    for await (const [key, value] of db.iterator({ gte: "room" })) {
      console.log({ key, value }, "here");
      for (const owner in value) {
        if (value[owner] === _req.user) {
          roomsdb[key] = value;
        }
      }
    }
    console.log(roomsdb);
    res.send(roomsdb);
  } catch (error) {
    console.log("nO FIELDS", error);
  }
});

app.get("/users", async (_req, res) => {
  res.send(await redisClient.smembers("users"));
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
  console.log(users); //todo: when tab is closed, the user status is not set to offline
  if (users) ws.send(JSON.stringify(users));
  const val = isAuth(request, ws);
  if (!val) return; //maybe retrieve the current connections?
  broadcastConnection(request, ws, "online");

  ws.on("message", async (msg) => {
    const obj = JSON.parse(msg);

    const { type } = obj;
    switch (type) {
      case "login":
        login({ type, id: obj.id });
        break;
      case "join":
        const room = obj["room"] ? obj.room : nanoid(); //todo: find existing room
        join(obj.from, obj.to, room, ws);
        break;
      case "leave":
        leave(params);
        break;
      case "message":
        console.log(rooms[obj.room], "room");
        const chat = Object.entries(rooms[obj.room]);
        for (const [, sock] of chat) {
          // console.log(
          //   sock === ws,
          //   "-----------------------------------------------------------------------------"
          // );

          sock.send(
            JSON.stringify({
              type: "message",
              emitter: obj.emitter,
              message: obj.id,
            })
          );
        }
        redisClient.xadd("chat_stream", "*", "message", msg);
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

  superagent
    .get("localhost:8090")
    .pipe(JSONStream.parse("*"))
    .on("data", (msg) => client.send(msg));
});
async function login(user) {
  const exists = users.find((u) => u === user.content);
  if (exists) {
    broadcast(exists);
  } else {
    users.push(user.content);
    broadcast(user);
  }
}
async function join(from, to, room, client) {
  console.log(from, to, room);
  for await (const roomdb of db.iterator({ gte: "room" })) {
    console.log(roomdb[0]);
    if (roomdb[0] === room) {
      // await db.put(`room/${room}`, { room: { member_1: from, member_2: to } });
      // rooms[room][from] = client;
      if (!rooms[room]) rooms[room] = {};
      if (rooms[room][from] === client) return;
      if (rooms[room]) {
        rooms[room][from] = client;
      }
      setTimeout(() => {
        console.log(rooms, "settime");
      }, 3000);
      return;
    } //todo: push client disconnected
    //todo: don't save the wsclient in the database
  }
  // let members;

  if (!rooms[room]) rooms[room] = {};
  if (rooms[room][from] === client) return;
  if (rooms[room]) {
    rooms[room][from] = client;
    rooms[room][to] = ""; // set second member as empty to validate later
  }

  await db.put(`room/${room}`, { member_1: from, member_2: to });
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
      console.log(req.user);
      client.send(
        JSON.stringify([
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

async function processStreamMessages() {
  while (true) {
    const [[, records_chat]] = await redisClientXRead.xread(
      "BLOCK",
      "0",
      "STREAMS",
      "chats_stream",
      lastRecordId
    );
    console.log(`User: ${JSON.stringify(records_chat)}`);
    for (const [recordId, [, user]] of records_chat) {
      broadcast(user);
      lastRecordId = recordId;
    }

    const [[, records]] = await redisClientXRead.xread(
      "BLOCK",
      "0",
      "STREAMS",
      "chat_stream",
      lastRecordId
    );
    for (const [recordId, [, message]] of records) {
      console.log(`Message from stream: ${message}`);
      broadcast(message);
      lastRecordId = recordId;
    }
  }
}

processStreamMessages().catch((err) => console.error(err));

server.listen(process.argv[2] || 8080, () =>
  console.log("server on port 8080")
);
function retrieveFrom() {} //todo: nothing
