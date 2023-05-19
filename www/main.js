import usersModal from "./users_modal.js";
import { headers } from "./utils.js";
import { drawRooms, openRoom } from "./rooms.js";

export let background_chat_preload = new Image();

const token = localStorage.getItem("login") ? localStorage.getItem("login") : 1;
const userInfo = localStorage.getItem("user_info")
  ? JSON.parse(localStorage.getItem("user_info"))
  : {};
export const ws = new WebSocket(`ws://${window.document.location.host}`, token);
sessionStorage.setItem("cr", undefined);
document.addEventListener("DOMContentLoaded", () => {
  console.log("after");
  background_chat_preload.src = "./image/background-chat.png"; //* preload

  header();
  drawRooms();
  usersModal();

  const info_name = document.createElement("span");
  info_name.innerText = userInfo.name;
  document.querySelector("#section").appendChild(info_name);

  //open users modal from welcome page
  document.querySelector("#welcome_btn").addEventListener("click", (e) => {
    e.preventDefault();
    usersModal(true);
  });
});
ws.onmessage = function (message) {
  let { type, data } = JSON.parse(message.data);
  if (Array.isArray(data)) {
    if (type === "message" || type === "stream") {
      if (type === "stream") {
        const div = document.createElement("div");
        const div2 = document.createElement("div");
        const total = document.createElement("span"); //total unread messages
        const span = document.createElement("span");

        div.classList = "new_messages_wrap";

        div.id = "new_messages_wrap";

        span.innerText = "Unread messages.";
        total.innerText = data.length;
        div.appendChild(div2);
        div2.appendChild(total);
        div2.appendChild(span);
        document.querySelector("#messages").appendChild(div);
      }
      drawMessages(data);
    }
  }
};

function header() {
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
  const btn = document.createElement("button");

  input.id = "login";
  input.classList = "login_input";
  input.placeholder = "Login...";
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
}

export function drawMessages(obj) {
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
