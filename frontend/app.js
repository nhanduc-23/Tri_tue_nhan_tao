const API_URL = "http://localhost:8000";
const SEND_INTERVAL_MS = 400;

const video = document.querySelector("#video");
const canvas = document.querySelector("#overlay");
const context = canvas.getContext("2d");
const statusText = document.querySelector("#status");
const statsBody = document.querySelector("#stats");
const instructionsList = document.querySelector("#instructions");
const startButton = document.querySelector("#start");
const stopButton = document.querySelector("#stop");

let stream = null;
let timer = null;
let requestInProgress = false;
const totals = new Map();
const classNames = {
  plastic_bottle: "Chai nhựa", metal_can: "Lon kim loại", milk_carton: "Hộp sữa giấy",
  battery: "Pin cũ", foam_container: "Vỏ hộp xốp", food_waste: "Thức ăn thừa",
  plastic_bag: "Túi nilon", paper: "Giấy",
};

function drawDetections(detections, imageWidth, imageHeight) {
  const scaleX = canvas.width / imageWidth;
  const scaleY = canvas.height / imageHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = Math.max(2, canvas.width / 300);
  context.font = `${Math.max(14, canvas.width / 35)}px system-ui`;
  detections.forEach((item) => {
    const [x1, y1, x2, y2] = item.bbox;
    const x = x1 * scaleX;
    const y = y1 * scaleY;
    const width = (x2 - x1) * scaleX;
    const height = (y2 - y1) * scaleY;
    context.strokeStyle = "#75f0a7";
    context.strokeRect(x, y, width, height);
    const label = `${classNames[item.class] || item.class} ${Math.round(item.confidence * 100)}%`;
    const textWidth = context.measureText(label).width;
    context.fillStyle = "#176b52";
    context.fillRect(x, Math.max(0, y - 26), textWidth + 12, 26);
    context.fillStyle = "white";
    context.fillText(label, x + 6, Math.max(18, y - 7));
  });
}

function updateSummary(detections) {
  const instructions = new Map();
  detections.forEach((item) => {
    totals.set(item.class, (totals.get(item.class) || 0) + 1);
    instructions.set(item.class, item.instruction);
  });
  statsBody.replaceChildren();
  if (!totals.size) {
    statsBody.innerHTML = '<tr><td colspan="2">Chưa có dữ liệu</td></tr>';
  } else {
    totals.forEach((count, key) => {
      const row = document.createElement("tr");
      row.innerHTML = `<td>${classNames[key] || key}</td><td>${count}</td>`;
      statsBody.append(row);
    });
  }
  instructionsList.replaceChildren();
  if (!instructions.size) {
    const item = document.createElement("li");
    item.textContent = "Không phát hiện vật thể trong khung hình này.";
    instructionsList.append(item);
  } else {
    instructions.forEach((instruction, key) => {
      const item = document.createElement("li");
      item.textContent = `${classNames[key] || key}: ${instruction}`;
      instructionsList.append(item);
    });
  }
}

async function sendFrame() {
  if (requestInProgress || !video.videoWidth) return;
  requestInProgress = true;
  try {
    const frame = document.createElement("canvas");
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    frame.getContext("2d").drawImage(video, 0, 0);
    canvas.width = frame.width;
    canvas.height = frame.height;
    const blob = await new Promise((resolve) => frame.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) throw new Error("Không tạo được ảnh từ camera.");
    const form = new FormData();
    form.append("file", blob, "frame.jpg");
    const response = await fetch(`${API_URL}/detect`, { method: "POST", body: form });
    if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
    const result = await response.json();
    const detections = result.detections || [];
    drawDetections(detections, frame.width, frame.height);
    updateSummary(detections);
    statusText.textContent = `${detections.length} vật thể (mock) trong khung hình gần nhất.`;
  } catch (error) {
    statusText.textContent = `Lỗi: ${error.message}`;
  } finally {
    requestInProgress = false;
  }
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream;
    await video.play();
    startButton.disabled = true;
    stopButton.disabled = false;
    statusText.textContent = "Camera bật; đang gửi khung hình định kỳ.";
    timer = window.setInterval(sendFrame, SEND_INTERVAL_MS);
  } catch (error) {
    statusText.textContent = `Không mở được camera: ${error.message}`;
  }
}

function stopCamera() {
  window.clearInterval(timer);
  timer = null;
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  startButton.disabled = false;
  stopButton.disabled = true;
  statusText.textContent = "Camera đã dừng.";
}

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);

