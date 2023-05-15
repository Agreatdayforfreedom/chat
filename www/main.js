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
let token = localStorage.getItem("login") ? localStorage.getItem("login") : 1;
const ws = new WebSocket(`ws://${window.document.location.host}`, token);
document.addEventListener("DOMContentLoaded", () => {
  drawRooms();
  usersModal();
  background_chat_preload.src = "./image/background-chat.png"; //? preload
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
    // ws.send(obj);
    await login(content);
    // localStorage.setItem("auth", content);
    document.querySelector("#login").value = "";
  });
});
ws.onmessage = function (message) {
  let { type, data } = JSON.parse(message.data);
  if (type === "message") messages_in_queue = true;
  if (Array.isArray(data)) {
    if (type === "users") {
      for (const o of data) {
        const el = JSON.parse(o);
        if (el.type === "status") drawUsers(el.user, el.status);
      }
      return;
    }
    if (type === "message" && messages_in_queue) {
      console.log("drawing from queue", data);
      drawMessages(data);
    }
  }
};

function drawMessages(obj) {
  let state = document.querySelectorAll("#message");
  //scroll start at bottom
  let _user = localStorage.getItem("login");

  for (const item of obj) {
    try {
      const data = JSON.parse(item);
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

      msgContent.innerText = data.message;
      if (data.sent) {
        msgDate.innerText = moment(parseInt(data.sent)).format("LT");
      }
      // msgContent.classList.add("message_bubble");
      msgDiv.appendChild(msgWrap);
      msgWrap.appendChild(msgBubble);
      msgBubble.appendChild(msgContent);
      msgBubble.appendChild(fix);
      msgBubble.appendChild(infoWrap);
      infoWrap.appendChild(msgDate);
      if (_user && _user === data.emitter) {
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
async function openRoom(from, to, room = "") {
  let state = document.querySelectorAll("#message");

  if (currentRoom === "" && room === "") {
    let obj = { from, to, type: "join" };
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
  document.querySelector("#header_chat_name").innerHTML = to;
  // document.querySelector(
  //   "#header_chat_picture"
  // ).src = ``;
  let open = document.querySelector("#open_chat");
  open.style.display = "flex";

  if (room && !messages_in_queue) {
    const res = await getMessages(room);
    const { type, data } = res;
    console.log("drawing from db", data);
    drawMessages(data); // todo: cache

    //todo: validate if(cache) {return cache } else drawMessages(data);
  }
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
    .then((res) => {
      console.log(res);
      return res.json();
    })
    .then(({ data }) => {
      console.log(data);
      if (data.name) {
        localStorage.setItem("login", data.name);
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
