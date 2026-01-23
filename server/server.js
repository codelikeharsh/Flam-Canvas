const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

//create express app
const app = express();

//create http server for sockt
const server = http.createServer(app);

// init sockt.io server
const io = new Server(server, {
  cors: { origin: "*" } // allow all origins
});
//serve static frontend files
app.use(express.static(path.join(__dirname, "../client")));
//stores all rooms data in memory
const rooms = {};

//some predefined colors for users
const COLORS = ["#e6194B", "#3cb44b", "#4363d8", "#f58231", "#911eb4"];

//helper to get or create a room
function getRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      users: {},        //connected users
      operations: []    //drawing operations
    };
  }
  return rooms[roomId];
}

//socket.io connection handler
io.on("connection", (socket) => {

  //user joins a specific room
  socket.on("room:join", ({ roomId }) => {
    const room = getRoom(roomId);

    //join socket.io room
    socket.join(roomId);

    //assign random color to user
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    room.users[socket.id] = { color };

    //send initial data to newly joined user
    socket.emit("room:init", {
      id: socket.id,
      users: room.users,
      operations: room.operations
    });

    //notify other users in room
    socket.to(roomId).emit("user:joined", {
      id: socket.id,
      color
    });

    //live stroke events
    socket.on("stroke:live", (data) => {
      socket.to(roomId).emit("stroke:live", {
        id: socket.id,
        data
      });
    });

    // when user finishes a stroke or shape
    socket.on("stroke:commit", (stroke) => {
      room.operations.push({
        id: stroke.id,
        type: "stroke",
        stroke,
        active: true
      });

      //broadcast updated canvas state
      io.to(roomId).emit("canvas:update", room.operations);
    });

// global undo
    socket.on("undo", () => {
      for (let i = room.operations.length - 1; i >= 0; i--) {
        if (room.operations[i].active) {
          room.operations[i].active = false;
          break;
        }
      }
      io.to(roomId).emit("canvas:update", room.operations);
    });

    //global redo
    socket.on("redo", () => {
      for (let i = room.operations.length - 1; i >= 0; i--) {
        if (!room.operations[i].active) {
          room.operations[i].active = true;
          break;
        }
      }
      io.to(roomId).emit("canvas:update", room.operations);
    });
    // cursor movement updates
    socket.on("cursor:move", (pos) => {
      socket.to(roomId).emit("cursor:update", {
        id: socket.id,
        pos
      });
    });
    //when user disconnects
    socket.on("disconnect", () => {
      delete room.users[socket.id];
      socket.to(roomId).emit("user:left", socket.id);
    });
  });
});
//start server on given port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
