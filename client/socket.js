// check if socket.io client script loaded properly
// this will fails if adblocker blocks socket.io(not for brave browser)
if (typeof io === "undefined") {
  alert("Socket.IO client failed to load. Disable ad blocker.");
  throw new Error("Socket.IO client not loaded");
}

// create socket connection with backend server
window.socket = io("https://drawing-canvas-liqe.onrender.com", {
  transports: ["websocket"]
});

// stores my socket id after connection
let myId = null;

// stores all users in current room
let users = {};

// stores cursor elements for other users
const cursors = {};

// when socket connects to server
socket.on("connect", () => {
  // join the room based on ROOM_ID from url
  socket.emit("room:join", {
    roomId: window.ROOM_ID
  });
});
// server sends initial room data after join
socket.on("room:init", (data) => {
  myId = data.id;               // my socket id
  users = data.users;           // list of users in room
  window.updateOperations(data.operations); // initial canvas state
  renderUsers();                // update users list ui
});

///uders 

// when a new user join the room
socket.on("user:joined", ({ id, color }) => {
  users[id] = { color };
  renderUsers();
});

// when a user leave the room
socket.on("user:left", (id) => {
  delete users[id];
  removeCursor(id); // remove cursor dot
  renderUsers();
});

///cavas

// server sends updated canvas operations
socket.on("canvas:update", (ops) => {
  window.updateOperations(ops);
});

///cursor

// update curso position of other user
socket.on("cursor:update", ({ id, pos }) => {
  updateCursor(id, pos);
});

//list of online users
function renderUsers() {
  const list = document.getElementById("userList");
  list.innerHTML = "";

  Object.entries(users).forEach(([id, user]) => {
    const li = document.createElement("li");

    //show "You" for current user
    li.textContent = id === myId ? "You" : `User ${id.slice(0, 4)}`;

    // set color assigned by server
    li.style.color = user.color;

    list.appendChild(li);
  });
}

// update or create cursor for a user
function updateCursor(id, pos) {
  if (!users[id]) return;

  let cursor = cursors[id];

  // create cursor element if not exist
  if (!cursor) {
    cursor = document.createElement("div");
    cursor.className = "cursor";
    cursor.style.background = users[id].color;
    document.getElementById("cursorLayer").appendChild(cursor);
    cursors[id] = cursor;
  }
  // move cursor using css transform
  cursor.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
}
// remove cursor when user disconnects
function removeCursor(id) {
  if (cursors[id]) {
    cursors[id].remove();
    delete cursors[id];
  }
}
