const socket = io("http://localhost:3000", {
  transports: ["websocket"]
});

let myId = null;
let users = {};
const cursors = {};

socket.on("connect", () => {
  socket.emit("room:join", {
    roomId: window.ROOM_ID
  });
});

/* -------- Init room -------- */
socket.on("room:init", (data) => {
  myId = data.id;
  users = data.users;
  window.updateOperations(data.operations);
  renderUsers();
});

/* -------- Users -------- */
socket.on("user:joined", ({ id, color }) => {
  users[id] = { color };
  renderUsers();
});

socket.on("user:left", (id) => {
  delete users[id];
  removeCursor(id);
  renderUsers();
});

/* -------- Canvas -------- */
socket.on("canvas:update", (ops) => {
  window.updateOperations(ops);
});

/* -------- Cursors -------- */
socket.on("cursor:update", ({ id, pos }) => {
  updateCursor(id, pos);
});

/* -------- UI helpers -------- */
function renderUsers() {
  const list = document.getElementById("userList");
  list.innerHTML = "";

  Object.entries(users).forEach(([id, user]) => {
    const li = document.createElement("li");
    li.textContent = id === myId ? "You" : `User ${id.slice(0, 4)}`;
    li.style.color = user.color;
    list.appendChild(li);
  });
}

function updateCursor(id, pos) {
  if (!users[id]) return;

  let cursor = cursors[id];
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.style.background = users[id].color;
    document.getElementById("cursorLayer").appendChild(cursor);
    cursors[id] = cursor;
  }

  cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
}

function removeCursor(id) {
  if (cursors[id]) {
    cursors[id].remove();
    delete cursors[id];
  }
}
