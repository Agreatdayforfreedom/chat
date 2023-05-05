const headers = {
  "Content-Type": "application/json",
};

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
  const form = document.querySelector("#auth");
  const input = document.createElement("input");
  input.id = "login";
  const btn = document.createElement("button");
  btn.type = "submit";
  btn.textContent = "login";
  form.appendChild(input);
  form.appendChild(btn);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const content = document.querySelector("#login").value;
    const obj = genData(content, "login");
    // ws.send(obj);
    const user = await login(content);
    console.log(user, "login");
    localStorage.setItem("auth", content);
    document.querySelector("#login").value = "";
  });
});
ws.onmessage = function (message) {
  let obj = JSON.parse(message.data);
  console.log({ obj });
  if (Array.isArray(obj)) {
    for (const o of obj) {
      const data = JSON.parse(o);
      console.log(data);
      if (data.type === "status") drawUsers(data.user, data.status);
    }
    return;
  }
  // if (obj.type === "status") return drawUsers(obj.user, obj.status);

  // if (JSON.parse(message.data).type === "login") {
  //   if (Array.isArray(JSON.parse(message.data).content)) {
  //     for (let i = 0; i < JSON.parse(message.data).content.length; i++) {
  //       drawUser(JSON.parse(message.data).content[i]);
  //     }
  //   } else {
  //     drawUser(JSON.parse(message.data).content);
  //   }
  // } else {
  const msgDiv = document.createElement("div");
  msgDiv.innerHTML = obj.message;
  document.getElementById("messages").appendChild(msgDiv);
  // }
};

let currentRoom = "";
const form = document.getElementById("msgForm");
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = document.getElementById("msgBox").value;
  let obj = genData(message, "message", currentRoom);
  console.log(currentRoom);
  ws.send(obj);
  document.getElementById("msgBox").value = "";
});
/***
  lol
*/
function openRoom(id, room = "") {
  document.querySelector("#to").innerHTML = `Send message to: ${id}`;
  let obj = genData(id, "join", room);

  ws.send(obj);
}
function drawUsers(user, status) {
  // const { users } = await getUsers();
  // for (const user of users) {
  const drawn = document.querySelector(`#${user}`);
  const wrap = document.createElement("div");
  if (drawn) {
    console.log(user, status);
    if (status === "offline") {
      drawn.classList = "user user-disconnected";
    } else drawn.classList = "user user-connected";
    return;
  }
  wrap.innerHTML = user;
  wrap.classList = "user";
  wrap.id = user;
  if (status === "offline") {
    wrap.classList.add("user-disconnected");
  } else wrap.classList.add("user-connected");

  document.getElementById("users").appendChild(wrap);
  wrap.addEventListener("click", (e) => {
    e.preventDefault();
    openRoom(localStorage.getItem("login"));
  });
  // }
}
async function drawRooms() {
  const rooms = await getRooms();
  console.log(rooms);
  for (const room in rooms) {
    let members = rooms[room];
    const wrap = document.createElement("div");
    wrap.innerHTML = room;
    wrap.classList = "user";
    wrap.id = room;
    document.getElementById("rooms").appendChild(wrap);
    wrap.addEventListener("click", (e) => {
      e.preventDefault();
      openRoom(localStorage.getItem("login"), room);
      currentRoom = room;
    });
  }
  // for (const user of users) {
  // }
}
// function drawUser(content) {
//   const user = document.createElement("div");
//   user.innerHTML = content;
//   user.id = content;
//   document.getElementById("users").appendChild(user);
//   user.addEventListener("click", (e) => {
//     openChat(e.target.id);
//   });
// }
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
  return await fetch("http://localhost:8080/rooms", { method: "GET", headers })
    .then((response) => response.json())
    .then((data) => data);
}

async function getUsers() {
  return await fetch("http://localhost:8080/users", { method: "GET", headers })
    .then((response) => response.json())
    .then((data) => data);
}
