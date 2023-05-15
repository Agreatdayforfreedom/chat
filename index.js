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

app.post("/login", async (req, res) => {
  // i don't like this
  try {
    const exists = await db.get(`user:${req.body.user}`);

    if (exists) return res.json({ data: exists });
  } catch (error) {
    let data = {
      name: req.body.user,
      avatar: `https://secure.gravatar.com/avatar/${Math.floor(
        Math.random() * 1000
      )}?s=90&d=identicon`,
      created_at: +new Date(),
    };
    await db.put(`user:${req.body.user}`, data);
    return res.json(data);
  }
});

app.get("/rooms", isAuthHttp, async (_req, res) => {
  try {
    let roomsdb = {};
    for await (const [key, value] of db.iterator({ gte: "room" })) {
      for (const owner in value) {
        if (value[owner] === _req.user) {
          roomsdb[key] = value;
        }
      }
    }
    res.send(roomsdb);
  } catch (error) {
    console.log("nO FIELDS", error);
  }
});

app.get("/messages/:room", isAuthHttp, processMessages);

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
  const auth_ws_client = request.headers["sec-websocket-protocol"];
  //todo: when tab is closed, the user status is not set to offline
  if (users) ws.send(JSON.stringify({ type: "users", data: users }));
  const val = isAuth(request, ws);
  if (!val) return; //maybe retrieve the current connections?
  broadcastConnection(request, ws, "online");
  ws.on("message", async (msg) => {
    const obj = JSON.parse(msg);
    const { type } = obj;
    switch (type) {
      case "join":
        const room = obj["room"] ? obj.room : nanoid(); //todo: find existing room
        join(obj.from, obj.to, room, ws);
        processStreamMessages(room, auth_ws_client, ws).catch((err) =>
          console.error(err)
        );
        console.log("passed");
        break;
      case "leave":
        leave(params);
        break;
      case "message":
        const chat = Object.entries(rooms[obj.room]);
        let date = +new Date();
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
                  message: obj.id,
                  sent: date,
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
            "message",
            obj.id,
            "emitter",
            obj.emitter,
            "sent",
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

  superagent
    .get("localhost:8090")
    .pipe(JSONStream.parse("*"))
    .on("data", (msg) => client.send(msg));
});
async function join(from, to, room, client) {
  console.log(from, to, room);

  const user = await db.get(`user:${from}`);
  //todo: attach info user to the room member
  for await (const roomdb of db.iterator({ gte: "room" })) {
    if (roomdb[0] === room) {
      if (!rooms[room]) rooms[room] = {};
      if (!room[from]) rooms[room][from] = {};
      if (rooms[room][from]["socket"] === client) return;
      if (rooms[room]) {
        rooms[room][from]["socket"] = client;
      }
      return;
    }
  }

  //open for first time a chat
  if (!rooms[room]) rooms[room] = {};
  if (!room[from]) rooms[room][from] = {};
  if (rooms[room][from]["socket"] === client) return;
  if (rooms[room]) {
    rooms[room][from]["socket"] = client;
    rooms[room][to] = {}; // set second member as empty to validate later
  }
  await db.put(`room:${room}`, {
    member_1: { info: from, socket: "" },
    member_2: { info: to, socket: "" },
  });
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

  console.log('----------s')
  try {
    
    
    const [[, records_chat]] = await redisClientXRead.xread(
      "STREAMS",
      stream,
      0
    );
    
  if (records_chat.length > 0) for (const [id, data] of records_chat) {
      var multi = data.reduce((a, c, i) => {
        return i % 2 === 0 ? a.concat([data.slice(i, i + 2)]) : a;
      }, []);
      let obj = Object.fromEntries(multi);
      
      messages.push(JSON.stringify(obj));
      console.log("pushed", user)
      console.log(obj.emitter, user)
      if(obj.emitter !== user) { // delete data when  recipient receives it
        await Promise.all([
          //room:dj921dh212dk:2dj19082jd-0 = {...data}
          await db.put(`${stream}:${id}`, JSON.stringify(obj)),
          await redisClientXRead.xdel(stream, id),
        ]).catch(err=>console.log(err));
      };
  }
} catch (error) {
  console.log("managing error")
  return
}
  
  if (messages.length > 0) {
    console.log("sending queue to: "+user, messages);
    ws.send(JSON.stringify({ type: "message", data: messages }));
  }
}

async function processMessages(request, response) {
  const { room } = request.params;
  const messages = [];
  let i = 1e9;
  while (i > 0) {
    i--;
  }
  // const messages = await db.iterator
  for await (const [_, message] of db.iterator({ gt: `${room}:` })) {
    messages.push(message);
  }
  console.log(messages, "db");
  response.json({ type: "message", data: messages });
}

//idea: load
server.listen(process.argv[2] || 8080, () =>
  console.log("server on port 8080")
);
