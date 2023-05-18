import { headers } from "./utils.js";
import { background_chat_preload, drawMessages } from "./main.js";
import { ws } from "./main.js";
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

export async function openRoom(from, to, room = "") {
  document.querySelector("#welcome_bg").style.display = "none";
  const currentRoom = parseInt(
    sessionStorage.getItem("cr") && sessionStorage.getItem("cr")
  );
  let state = document.querySelectorAll("#message");
  if (!currentRoom && room === "") {
    console.log("joining");

    let obj = { from: from.id, to: to.id, type: "join" };
    console.log(obj, from.id);
    ws.send(JSON.stringify(obj));
  }
  if (currentRoom === room.id) {
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
  sendMessage(room.id);
  if (room) {
    const res = await getMessages(room.id);
    const { type, data } = res;
    drawMessages(data);
    sessionStorage.setItem("cr", room.id);
    let obj = { from: from.id, to: to.id, type: "join", room: room.id };
    ws.send(JSON.stringify(obj));
  }
}

export async function drawRooms() {
  const { data } = await getRooms();
  for (const room of data) {
    console.log(room);
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
      openRoom(from, to, room);
    });
  }
}

function sendMessage(room) {
  const id = localStorage.getItem("login");
  const form = document.getElementById("msgForm");
  form.addEventListener("submit", (event) => {
    console.log("sending", room);
    event.preventDefault();
    const message = document.getElementById("msgBox").value;
    let obj = {
      content: message,
      type: "message",
      room,
      emitter: id,
    };
    ws.send(JSON.stringify(obj));
    document.getElementById("msgBox").value = "";
  });
}
