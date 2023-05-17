import usersModal from "./users_modal.js";
import { headers } from "./utils.js";
let currentRoom = ""; //todo: save it somewhere else
let background_chat_preload = new Image();
let messages_in_queue = false;
let cache_supported = "caches" in self;

function genData(id, type, room = "") {
  let obj = {};
  // let auth = localStorage.getItem("auth");
  switch (type) {
    case "login":
      obj = {
        type,
        id: id,
      };
      break;
    case "join":
      obj = {
        type,
        id,
        room,
      };
      break;
    case "message":
      obj = {
        type,
        id: id,
        room,
      };
      break;
    default:
      throw new Error("unknow type:" + type);
  }
  return JSON.stringify(obj);
}
const token = localStorage.getItem("login") ? localStorage.getItem("login") : 1;
const userInfo = localStorage.getItem("user_info")
  ? JSON.parse(localStorage.getItem("user_info"))
  : {};
const ws = new WebSocket(`ws://${window.document.location.host}`, token);
document.addEventListener("DOMContentLoaded", () => {
  drawRooms();
  usersModal();
  background_chat_preload.src = "./image/background-chat.png"; //? preload
  const form = document.querySelector("#auth");
  const users_btn = document.querySelector("#users_wrap");
  const info_name = document.createElement("span");
  info_name.innerText = userInfo.name;
  document.querySelector("#section").appendChild(info_name);
  if (localStorage.getItem("login")) {
    form.remove();
    users_btn.style.display = "block";
  } else {
    form.style.display = "flex";
    users_btn.remove();
  }
  const input = document.createElement("input");
  input.id = "login";
  input.classList = "login_input";
  input.placeholder = "Login...";
  const btn = document.createElement("button");
  btn.type = "submit";
  btn.classList = "login_btn";
  btn.textContent = "Login";
  form.appendChild(input);
  form.appendChild(btn);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = document.querySelector("#login").value;
    // ws.send(obj);
    await login(content);
    // localStorage.setItem("auth", content);
    document.querySelector("#login").value = "";
  });
});
ws.onmessage = function (message) {
  let { type, data } = JSON.parse(message.data);
  console.log(type, "TYPE");
  // if (type === "message") {
  //   messages_in_queue = true;
  // }
  if (Array.isArray(data)) {
    // if (type === "users") {
    //   for (const o of data) {
    //     const el = JSON.parse(o);
    //     // if (el.type === "status") drawUsers(el.user, el.status);
    //   }
    //   return;
    // }
    if (type === "message") {
      console.log("drawing from queue", data);
      console.log("should second ");
      drawMessages(data);
    }
  }
};

function drawMessages(obj) {
  //scroll start at bottom
  let _user = localStorage.getItem("login");
  for (const item of obj) {
    try {
      let data = typeof item === "string" ? JSON.parse(item) : item;
      const msgDiv = document.createElement("div");
      const msgWrap = document.createElement("div");
      const infoWrap = document.createElement("div");
      const msgBubble = document.createElement("div");
      // const msgCheck = document.createElement("span");

      const fix = document.createElement("span");
      const msgContent = document.createElement("span");
      const msgDate = document.createElement("span");
      msgDiv.id = "message";
      msgDiv.classList.add("message");
      msgWrap.classList.add("message_wrap");
      msgBubble.classList.add("message_bubble");
      infoWrap.classList.add("message_info");
      fix.classList.add("fix");
      msgContent.classList.add("message_text");
      msgDate.classList.add("timestamp_sent");

      msgContent.innerText = data.content;
      if (data.created_at) {
        msgDate.innerText = moment(parseInt(data.created_at)).format("LT");
      }
      // msgContent.classList.add("message_bubble");
      msgDiv.appendChild(msgWrap);
      msgWrap.appendChild(msgBubble);
      msgBubble.appendChild(msgContent);
      msgBubble.appendChild(fix);
      msgBubble.appendChild(infoWrap);
      infoWrap.appendChild(msgDate);
      console.log(data.emitter === _user);
      if (_user && _user === data.emitter.toString()) {
        msgDiv.classList.add("message_right");
        infoWrap.innerHTML += `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="check bi bi-check-all" viewBox="0 0 16 12"> <path d="M8.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L2.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093L8.95 4.992a.252.252 0 0 1 .02-.022zm-.92 5.14.92.92a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 1 0-1.091-1.028L9.477 9.417l-.485-.486-.943 1.179z"/> </svg>`;
      }

      // infoWrap.append(msgCheck);
      document.getElementById("messages").appendChild(msgDiv);
      let scroll = document.querySelector("#messages");
      scroll.scrollTop = scroll.scrollHeight;
    } catch (error) {
      console.log(error);
    }
  }
}

const form = document.getElementById("msgForm");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = document.getElementById("msgBox").value;
  let obj = {
    content: message,
    type: "message",
    room: currentRoom.id,
    emitter: userInfo,
  };
  ws.send(JSON.stringify(obj));
  document.getElementById("msgBox").value = "";
});
/***
  lol
*/
async function openRoom(from, to, room = "") {
  let state = document.querySelectorAll("#message");
  if (currentRoom === "" && room === "") {
    let obj = { from: from.id, to: to.id, type: "join" };
    ws.send(JSON.stringify(obj));
  }
  if (currentRoom === room) {
    // currentRoom = room ? room : "";
    return;
  } else {
    for (const el of state) {
      el.remove();
    }
  }
  let background = document.querySelector("#messages");
  background.style.background = `linear-gradient(rgba(22, 22, 22, 0.5), rgba(123, 64, 21, 0.5)), url(${background_chat_preload.src})`;
  document.querySelector("#header_chat_name").innerHTML = to.name;
  document.querySelector("#header_chat_picture").src = to.avatar;
  let open = document.querySelector("#open_chat");
  open.style.display = "flex";
  console.log({ from, to });

  if (room) {
    const res = await getMessages(room);
    const { type, data } = res;
    console.log("drawing from db", data);
    drawMessages(data);
    console.log("should first ");
  }

  let obj = { from: from.id, to: to.id, type: "join", room: room.id };
  ws.send(JSON.stringify(obj));
  currentRoom = room ? room : "";
}
export async function drawUsers(user) {
  // const users = await getUsers();
  console.log(user);
  // const { users } = await getUsers();
  // for (const user of users) {
  const drawn = document.querySelector(`#${user.name}`);
  const wrap = document.createElement("div");
  const wrap_info = document.createElement("div");
  wrap_info.classList = "wrap_info";
  const name = document.createElement("h3");
  const statusElement = document.createElement("span");
  const open = document.createElement("button");

  open.innerText = "open";
  open.classList = "btn_open_chat";
  name.innerText = user.name;
  name.classList = "user_name";
  wrap.classList = "user_card";

  statusElement.id = user.id;
  // statusElement.innerText = status;
  // if (drawn) {
  //   // drawn.innerText = status;
  //   if (status === "offline") {
  //     drawn.classList = "user-disconnected";
  //   } else drawn.classList = "user-connected";
  //   return;
  // }
  // if (status === "offline") {
  //   statusElement.classList.add("user-disconnected");
  // } else statusElement.classList.add("user-connected");

  wrap.appendChild(wrap_info);
  wrap_info.appendChild(name);
  wrap_info.appendChild(statusElement);
  wrap.appendChild(open);

  const modal = document.getElementById("user_cards");
  if (modal) {
    modal.appendChild(wrap);

    open.addEventListener("click", (e) => {
      e.preventDefault();
      openRoom(userInfo, user);
    });
  }
  // }
}
async function drawRooms() {
  const { data } = await getRooms();
  for (const room of data) {
    console.log(room);
    //room[0] = room id, room[1] = members object
    let from;
    let to;
    const wrap = document.createElement("div");
    const name = document.createElement("span");
    const img = document.createElement("img");

    wrap.classList = "room";
    wrap.id = room.id;
    for (const client in room) {
      if (
        room[client] &&
        localStorage.getItem("login") &&
        parseInt(localStorage.getItem("login")) !== room[client].id
      ) {
        to = room[client];
        name.innerText = room[client].name;
        name.classList.add("name_user_card");
        img.src = room[client].avatar;
        img.alt = `${room[client].name} avatar`;
        img.classList.add("avatar_user_card");
      }
      if (parseInt(localStorage.getItem("login")) === room[client].id)
        from = room[client];
    }
    wrap.appendChild(img);
    wrap.appendChild(name);
    document.getElementById("rooms").appendChild(wrap);
    wrap.addEventListener("click", (e) => {
      e.preventDefault();
      console.log({ from, to, room });
      openRoom(from, to, room);
    });
  }
}

//*http

async function login(user) {
  return await fetch("http://localhost:8080/login", {
    method: "POST",
    headers,
    body: JSON.stringify({
      user,
    }),
  })
    .then((res) => {
      console.log(res);
      return res.json();
    })
    .then(({ data }) => {
      console.log(data);
      if (data.name) {
        localStorage.setItem("login", data.id);
        localStorage.setItem("user_info", JSON.stringify(data));
      }
      return data;
    });
}

async function getMessages(room) {
  return await fetch(`http://localhost:8080/messages/${room}`, {
    method: "GET",
    headers: {
      ...headers,
      authorization: localStorage.getItem("login"),
    },
  })
    .then((response) => response.json())
    .then((data) => data);
}

async function getRooms() {
  return await fetch("http://localhost:8080/rooms", {
    method: "GET",
    headers: {
      ...headers,
      authorization: localStorage.getItem("login"),
    },
  })
    .then((response) => response.json())
    .then((data) => data);
}

async function getUsers() {
  return await fetch("http://localhost:8080/users", { method: "GET", headers })
    .then((response) => response.json())
    .then((data) => data);
}
