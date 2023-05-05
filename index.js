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
import qs from "query-string";
import { isAuth } from "./auth.js";

const redisClient = new Redis();
const redisClientXRead = new Redis();
const app = express();

const server = createServer(app);

app.use(express.json());
app.use(express.static("www"));
const db = new Level("chat", { valueEncoding: "json" });
let users = [];
let rooms = {};

app.get("/", (req, res) => {
  staticHandler(req, res, { public: "www" });
});

app.post("/login", (req, res) => {
  const exists = users.find((user) => user === req.body.user);
  if (exists) return res.send("User already exists");

  users.push(req.body.user);
  return res.send(req.body);
});

app.get("/rooms", async (_req, res) => {
  try {
    let roomsdb = {};
    for await (const [key, value] of db.iterator({ gte: "room" })) {
      roomsdb[key] = value; // 2
    }

    res.send(roomsdb);
  } catch (error) {
    console.log("nO FIELDS");
  }
});

app.get("/users", (_req, res) => {
  res.send({ users });
});

// const server = createServer((req, res) => {
//   console.log(req.url, "here");

//   if (req.url.startsWith("/login")) {
//     //login
//     req.on("data", (data) => {
//       console.log(qs.stringify(data));
//     });
//     // const exists = users.find(u => u === req.)
//     return res.end(JSON.stringify({ ok: "goe" }));
//   }
//   return staticHandler(req, res, { public: "www" });
// });

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
  if (users) ws.send(JSON.stringify(users));
  const val = isAuth(request, ws);
  if (!val) return; //maybe retrieve the current connections?
  broadcastConnection(request, ws, "online");

  setTimeout(async () => {
    const users = await redisClient.smembers("users");
    console.log(users);
  }, 1000);
  // client.on("open", () => {
  //   broadcast({ type: "login", content: users }); //todo: send rooms instead
  // }); //todo: send users and when it's clicked create a new room
  ws.on("message", async (msg) => {
    const obj = JSON.parse(msg);

    const { type, id } = obj;
    switch (type) {
      case "login":
        login({ type, id });
        break;
      case "join":
        const room = obj["room"] ? obj.room : nanoid();
        join(room, id, ws);
        break;
      case "leave":
        leave(params);
        break;
      case "message":
        console.log(rooms[obj.room]);
        const chat = Object.entries(rooms[obj.room]);
        for (const [n, sock] of chat) {
          console.log(
            sock === ws,
            "-----------------------------------------------------------------------------"
          );

          sock.send(JSON.stringify({ type: "message", message: id }));
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
    // ws.close();

    // let toFormat = { type: "online", user: request.user };
    // console.log(toFormat);
    // redisClient.smembers(); //todo:remove from set

    // leave(ws);
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
async function join(room, id, client) {
  // console.log({ room, id });
  // client.send(`saving user: ${id} in ${room}`);
  //*validate that

  if (!rooms[room]) rooms[room] = {};
  if (rooms[room][id] === client) return;
  if (rooms[room]) rooms[room][id] = client;

  await db.put(`room/${room}`, { ...rooms[room] });
  // if(!exists)

  // console.log(rooms[room]);
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
