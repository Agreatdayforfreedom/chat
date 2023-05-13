import usersModal from "./users_modal.js";
import { headers } from "./utils.js";
let currentRoom = ""; //todo: save it somewhere else

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
let token = localStorage.getItem("login") ? localStorage.getItem("login") : 1;
const ws = new WebSocket(`ws://${window.document.location.host}`, token);
document.addEventListener("DOMContentLoaded", () => {
  // drawUsers();
  drawRooms();
  usersModal();
  const form = document.querySelector("#auth");
  const users_btn = document.querySelector("#users_wrap");
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
    const obj = genData(content, "login");
    // ws.send(obj);
    const user = await login(content);
    localStorage.setItem("auth", content);
    document.querySelector("#login").value = "";
  });
});
ws.onmessage = function (message) {
  let { type, data } = JSON.parse(message.data);
  if (Array.isArray(data)) {
    if (type === "users") {
      for (const o of data) {
        const el = JSON.parse(o);
        if (el.type === "status") drawUsers(el.user, el.status);
      }
      return;
    }
    drawMessages(data);
  }
};

function drawMessages(obj, room) {
  let state = document.querySelectorAll("#message");
  //scroll start at bottom
  let _user = localStorage.getItem("login");
  console.log(room, currentRoom);

  for (const item of obj) {
    const data = JSON.parse(item);
    const msgDiv = document.createElement("div");
    const msgWrap = document.createElement("div");
    const msgContent = document.createElement("span");
    msgDiv.id = "message";
    msgDiv.classList.add("message");
    msgWrap.classList.add("message_wrap");

    if (_user && _user === data.emitter) {
      msgDiv.classList.add("message_right");
    }

    msgContent.innerHTML = data.message;
    msgContent.classList.add("message_bubble");
    msgDiv.appendChild(msgWrap);
    msgWrap.appendChild(msgContent);
    document.getElementById("messages").appendChild(msgDiv);
    let scroll = document.querySelector("#messages");
    scroll.scrollTop = scroll.scrollHeight;
  }
}

const form = document.getElementById("msgForm");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = document.getElementById("msgBox").value;
  let obj = {
    id: message,
    type: "message",
    room: currentRoom,
    emitter: localStorage.getItem("login"),
  };
  ws.send(JSON.stringify(obj));
  document.getElementById("msgBox").value = "";
});
/***
  lol
*/
function openRoom(from, to, room = "") {
  if (currentRoom === room) return;
  let state = document.querySelectorAll("#message");

  if (room !== currentRoom) {
    for (const el of state) {
      el.remove();
    }
  }
  document.querySelector(
    "#messages"
  ).style.background = `linear-gradient(rgba(22, 22, 22, 0.5), rgba(22, 22, 22, 0.5)),
  url("./image/background.jpg")`;
  document.querySelector("#header_chat_name").innerHTML = to;
  document.querySelector(
    "#header_chat_picture"
  ).src = `https://secure.gravatar.com/avatar/${Math.floor(
    Math.random() * 1000
  )}?s=90&d=identicon`;
  let open = document.querySelector("#open_chat");
  open.style.display = "flex";

  let obj = { from, to, type: "join", room };
  ws.send(JSON.stringify(obj));
  currentRoom = room ? room : "";
}
export function drawUsers(user, status) {
  // const { users } = await getUsers();
  // for (const user of users) {
  const drawn = document.querySelector(`#${user}`);
  const wrap = document.createElement("div");
  const wrap_info = document.createElement("div");
  wrap_info.classList = "wrap_info";
  const name = document.createElement("h3");
  const statusElement = document.createElement("span");
  const open = document.createElement("button");

  open.innerText = "open";
  open.classList = "btn_open_chat";
  name.innerText = user;
  name.classList = "user_name";
  wrap.classList = "user_card";

  statusElement.id = user;
  statusElement.innerText = status;
  if (drawn) {
    drawn.innerText = status;
    if (status === "offline") {
      drawn.classList = "user-disconnected";
    } else drawn.classList = "user-connected";
    return;
  }
  if (status === "offline") {
    statusElement.classList.add("user-disconnected");
  } else statusElement.classList.add("user-connected");

  wrap.appendChild(wrap_info);
  wrap_info.appendChild(name);
  wrap_info.appendChild(statusElement);
  wrap.appendChild(open);

  const modal = document.getElementById("user_cards");
  if (modal) {
    modal.appendChild(wrap);

    open.addEventListener("click", (e) => {
      e.preventDefault();
      openRoom(localStorage.getItem("login"), user);
    });
  }
  // }
}
async function drawRooms() {
  const rooms = await getRooms();
  for (const room of Object.entries(rooms)) {
    //room[0] = room id, room[1] = members object
    let to = "";
    const wrap = document.createElement("div");
    // if(room[1].length)
    for (const client in room[1]) {
      if (
        localStorage.getItem("login") &&
        localStorage.getItem("login") !== room[1][client]
      ) {
        to = room[1][client];
        wrap.innerText = room[1][client];
      }
    }
    wrap.classList = "room";
    wrap.id = room[0];
    document.getElementById("rooms").appendChild(wrap);
    wrap.addEventListener("click", (e) => {
      e.preventDefault();
      openRoom(localStorage.getItem("login"), to, room[0]);
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
    .then((res) => res.json())
    .then((data) => {
      localStorage.setItem("login", data.user);
      return data.user;
    });
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
