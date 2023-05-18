import { openRoom } from "./rooms.js";

export async function drawUsers(user) {
  const userInfo = localStorage.getItem("user_info");
  console.log(userInfo, "INFO");
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
      if (userInfo) openRoom(JSON.parse(userInfo), user);
    });
  }
  // }
}
