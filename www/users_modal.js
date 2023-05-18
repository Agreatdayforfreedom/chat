import { drawUsers } from "./users.js";
import { headers } from "./utils.js";
async function loadUsers() {
  return await fetch("http://localhost:8080/users", {
    method: "GET",
    withCredentials: true,
    credentials: "include",
    headers: {
      ...headers,
    },
  })
    .then((response) => response.json())
    .then((data) => data);
}

export default function usersModal(extern_open) {
  let open = false;
  let cache = false;
  //prettier-ignore
  if(extern_open) modal()
  document.querySelector("#btn_users").addEventListener("click", () => modal());

  async function modal() {
    if (open) {
      open = false;
      return document.querySelector("#users_container").remove();
    }

    const container = document.createElement("div");
    container.id = "users_container";
    container.classList.add("users_container");

    const div = document.createElement("div");
    const user_cards = document.createElement("div");
    user_cards.id = "user_cards";
    user_cards.classList = "user_cards";
    div.id = "users_modal";
    div.classList.add("users_modal");

    const close = document.createElement("div");
    close.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 close">
      <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clip-rule="evenodd" />
    </svg>
    `;
    close.addEventListener("click", () => modal());

    container.appendChild(div);
    div.appendChild(close);
    div.appendChild(user_cards);
    document.querySelector("#users_modal_wrap").appendChild(container);
    open = true;

    if (!cache) {
      let spinner = `<div class="spinner">
        <div class="bounce1"></div>
        <div class="bounce2"></div>
        <div class="bounce3"></div>
        </div>`;

      const spinner_div = document.createElement("div");
      spinner_div.id = "spinner";
      spinner_div.classList = "spinner_container";
      spinner_div.innerHTML = spinner.trim();

      div.appendChild(spinner_div);
    }
    //draw users
    const users = await loadUsers();
    if (users) {
      cache = true;
      const spinner = document.querySelector("#spinner");
      if (spinner) {
        spinner.remove();
      }
      for (const user of users) {
        // let data = JSON.parse(user);
        drawUsers(user);
      }
    }
  }
}
