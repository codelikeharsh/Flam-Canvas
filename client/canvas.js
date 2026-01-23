// setting up canvas
// get canvas element from DOM
const canvas = document.getElementById("canvas");

// get 2d context for drawing
const ctx = canvas.getContext("2d");

// round edges so strokes dont look sharp
ctx.lineCap = "round";
ctx.lineJoin = "round";
// list of all drawing operations coming from server
// server is main source of truth
let operations = [];

// used to track if user is currently drawing
let isDrawing = false;

// stores points while user is drawing freehand
let livePoints = [];

// used only for shape preview before final commit
let shapePreview = null;
// current selected tool
let tool = "brush";

// current selected color
let currentColor = "#000000";

// current brush width
let brushWidth = 5;
// this function is called from socket.js
// server sends updated operations array
window.updateOperations = function (ops) {
  operations = ops;
  redrawCanvas(); // redraw whole canvas from server state
};

///canvas ui design
// color picker input
const colorPickerInput = document.getElementById("colorPicker");

// brush size slider
const brushSizeInput = document.getElementById("brushSize");

// mapping tools to buttons
const toolButtons = {
  brush: document.getElementById("brushBtn"),
  eraser: document.getElementById("eraserBtn"),
  line: document.getElementById("lineBtn"),
  rect: document.getElementById("rectBtn"),
  circle: document.getElementById("circleBtn"),
  triangle: document.getElementById("triangleBtn")
};

// undo and redo buttons
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

// update current color when picker changes
colorPickerInput.onchange = e => currentColor = e.target.value;

// update brush width when slider moves
brushSizeInput.oninput = e => brushWidth = parseInt(e.target.value);

// attach click events to tool buttons
Object.entries(toolButtons).forEach(([name, btn]) => {
  btn.onclick = () => setTool(name);
});

// undo and redo are handled by server
undoBtn.onclick = () => socket.emit("undo");
redoBtn.onclick = () => socket.emit("redo");

// set active tool and update ui
function setTool(t) {
  tool = t;

  // remove active class from all tools
  Object.values(toolButtons).forEach(b => b.classList.remove("active"));

  // mark selected tool as active
  toolButtons[t].classList.add("active");
}
// triggered when user presses mouse / touch
canvas.addEventListener("pointerdown", e => {
  canvas.setPointerCapture(e.pointerId);
  isDrawing = true;

  const p = getPoint(e);

  // freehand tools
  if (tool === "brush" || tool === "eraser") {
    livePoints = [p];
  }
  // shape tools
  else {
    shapePreview = {
      type: "shape",
      shape: tool,
      start: p,
      end: p,
      color: currentColor,
      size: brushWidth
    };
  }
});

// triggered when pointer moves
canvas.addEventListener("pointermove", e => {
  if (!isDrawing) return;

  const p = getPoint(e);

  // freehand drawing logic
  if (tool === "brush" || tool === "eraser") {
    livePoints.push(p);

    // redraw committed strokes only
    redrawCanvas();

    // draw current stroke smoothly on top
    drawLiveSmoothStroke();
  }
  // shape preview logic
  else {
    shapePreview.end = p;
    redrawCanvas();
    drawShape(shapePreview);
  }

  // send cursor position to other users
  socket.emit("cursor:move", p);
});

// triggered when user releases mouse / touch
canvas.addEventListener("pointerup", () => {
  if (!isDrawing) return;
  isDrawing = false;

  // freehand commit
  if (tool === "brush" || tool === "eraser") {
    const stroke = {
      id: crypto.randomUUID(),
      type: "free",
      points: livePoints,
      color: currentColor,
      size: tool === "eraser" ? brushWidth * 2 : brushWidth,
      tool
    };

    // optimistic local update so ui feels instant
    operations.push({ stroke, active: true });
    redrawCanvas();

    // send final stroke to server
    socket.emit("stroke:commit", stroke);

    livePoints = [];
  }
  // shape commit
  else if (shapePreview) {
    socket.emit("stroke:commit", {
      id: crypto.randomUUID(),
      ...shapePreview
    });
    shapePreview = null;
  }
});

// draws current freehand stroke while user is drawing
// this does NOT clear canvas
function drawLiveSmoothStroke() {
  if (livePoints.length < 2) return;

  ctx.save();
  ctx.lineWidth = tool === "eraser" ? brushWidth * 2 : brushWidth;
  ctx.strokeStyle = currentColor;

  // eraser uses destinationout mode
  ctx.globalCompositeOperation =
    tool === "eraser" ? "destination-out" : "source-over";

  ctx.beginPath();
  ctx.moveTo(livePoints[0].x, livePoints[0].y);

  // quadratic smoothing for better strokes because before they were jagged 
  for (let i = 1; i < livePoints.length - 1; i++) {
    const midX = (livePoints[i].x + livePoints[i + 1].x) / 2;
    const midY = (livePoints[i].y + livePoints[i + 1].y) / 2;
    ctx.quadraticCurveTo(livePoints[i].x, livePoints[i].y, midX, midY);
  }

  ctx.lineTo(
    livePoints.at(-1).x,
    livePoints.at(-1).y
  );

  ctx.stroke();
  ctx.restore();
}

/// different shapes

// draws shape based on type
function drawShape(s) {
  ctx.save();
  ctx.lineWidth = s.size;
  ctx.strokeStyle = s.color;

  switch (s.shape) {
    case "line":
      ctx.beginPath();
      ctx.moveTo(s.start.x, s.start.y);
      ctx.lineTo(s.end.x, s.end.y);
      ctx.stroke();
      break;

    case "rect":
      ctx.strokeRect(
        s.start.x,
        s.start.y,
        s.end.x - s.start.x,
        s.end.y - s.start.y
      );
      break;

    case "circle":
      const r = Math.hypot(s.end.x - s.start.x, s.end.y - s.start.y);
      ctx.beginPath();
      ctx.arc(s.start.x, s.start.y, r, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case "triangle":
      ctx.beginPath();
      ctx.moveTo(s.start.x, s.end.y);
      ctx.lineTo((s.start.x + s.end.x) / 2, s.start.y);
      ctx.lineTo(s.end.x, s.end.y);
      ctx.closePath();
      ctx.stroke();
      break;
  }

  ctx.restore();
}
// clears canvas and redraws everything from operations
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  operations.forEach(op => {
    if (!op.active) return;

    if (op.stroke.type === "free") {
      drawFinalFreeStroke(op.stroke);
    } else if (op.stroke.type === "shape") {
      drawShape(op.stroke);
    }
  });
}

// redraws a freehand stroke from stored points
function drawFinalFreeStroke(stroke) {
  ctx.save();
  ctx.lineWidth = stroke.size;
  ctx.strokeStyle = stroke.color;

  ctx.globalCompositeOperation =
    stroke.tool === "eraser" ? "destination-out" : "source-over";

  const pts = stroke.points;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }

  ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
  ctx.stroke();
  ctx.restore();
}

// resize canvas on window resize
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  redrawCanvas(); // redraw after resize
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// convert screen coords to canvas coords
function getPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
