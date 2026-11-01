const API_URL = "";
const SEND_INTERVAL_MS = 600;
const MAX_FRAME_SIDE = 640;
const BIN_COLORS = { yellow: "#f2ca28", green: "#31945b", gray: "#737b80", orange: "#ed8733", blue: "#3478c7", red: "#ca4545" };

const video = document.querySelector("#video");
const snapshot = document.querySelector("#snapshot");
const photoInput = document.querySelector("#photo-input");
const photoButton = document.querySelector("#photo-button");
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
let lastDetections = [];
let lastImageWidth = 0;
let lastImageHeight = 0;
let snapshotUrl = null;

function activeMedia() {
  return snapshot && !snapshot.hidden ? snapshot : video;
}

function resizeOverlay() {
  const media = activeMedia();
  const rect = media.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  drawDetections(lastDetections, lastImageWidth, lastImageHeight);
}

function drawDetections(detections, imageWidth, imageHeight) {
  if (!imageWidth || !imageHeight) return;
  const media = activeMedia();
  const rect = media.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  const scaleX = (rect.width * dpr) / imageWidth;
  const scaleY = (rect.height * dpr) / imageHeight;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = Math.max(2, rect.width / 300) * dpr;
  context.font = `${Math.max(14, rect.width / 35) * dpr}px system-ui`;
  detections.forEach((item) => {
    if (!Array.isArray(item.bbox) || item.bbox.length !== 4) return;
    const [x1, y1, x2, y2] = item.bbox;
    const x = x1 * scaleX;
    const y = y1 * scaleY;
    const width = (x2 - x1) * scaleX;
    const height = (y2 - y1) * scaleY;
    context.strokeStyle = "#75f0a7";
    context.strokeRect(x, y, width, height);
    const label = `${item.class_vi || item.class} ${Math.round((item.confidence || 0) * 100)}%`;
    const textWidth = context.measureText(label).width;
    const labelY = Math.max(0, y - 26);
    context.fillStyle = "#176b52";
    context.fillRect(x, labelY, textWidth + 12 * dpr, 26 * dpr);
    context.fillStyle = "white";
    context.fillText(label, x + 6 * dpr, Math.max(18 * dpr, labelY + 19 * dpr));
  });
}

function updateSummary(detections) {
  const latest = new Map();
  detections.forEach((item) => {
    const key = item.class || "unknown";
    totals.set(key, (totals.get(key) || 0) + 1);
    latest.set(key, item);
  });
  statsBody.replaceChildren();
  if (!totals.size) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 2;
    cell.textContent = "Chưa có dữ liệu";
    row.append(cell);
    statsBody.append(row);
  } else {
    totals.forEach((count, key) => {
      const row = document.createElement("tr");
      const name = document.createElement("td");
      const total = document.createElement("td");
      name.textContent = latest.get(key)?.class_vi || key;
      total.textContent = String(count);
      row.append(name, total);
      statsBody.append(row);
    });
  }

  instructionsList.replaceChildren();
  if (!detections.length) {
    const item = document.createElement("li");
    item.textContent = "Không phát hiện vật thể trong khung hình này.";
    instructionsList.append(item);
  } else {
    detections.forEach((detection) => {
      const item = document.createElement("li");
      item.style.setProperty("--bin-color", BIN_COLORS[detection.bin_color] || detection.bin_color || "#737b80");
      const label = document.createElement("span");
      label.className = "bin-label";
      label.textContent = `${detection.class_vi || detection.class} · thùng ${detection.bin_color || "chưa rõ"}: `;
      const instruction = document.createElement("span");
      instruction.textContent = detection.instruction || "Làm theo hướng dẫn phân loại tại địa phương.";
      item.append(label, instruction);
      instructionsList.append(item);
    });
  }
}

async function sendFrame() {
  if (requestInProgress || !video.videoWidth || !stream) return;
  requestInProgress = true;
  try {
    const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const frame = document.createElement("canvas");
    frame.width = Math.max(1, Math.round(video.videoWidth * scale));
    frame.height = Math.max(1, Math.round(video.videoHeight * scale));
    frame.getContext("2d").drawImage(video, 0, 0, frame.width, frame.height);
    const blob = await new Promise((resolve) => frame.toBlob(resolve, "image/jpeg", 0.7));
    if (!blob) throw new Error("Không tạo được ảnh từ camera.");
    await submitImage(blob, "frame.jpg");
  } catch (error) {
    statusText.textContent = error.message;
  } finally {
    requestInProgress = false;
  }
}

async function submitImage(blob, filename) {
  const form = new FormData();
  form.append("file", blob, filename);
  let response;
  try {
    response = await fetch(`${API_URL}/detect`, { method: "POST", body: form });
  } catch (_error) {
    throw new Error("Backend không phản hồi. Kiểm tra kết nối tunnel và thử lại.");
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 400) throw new Error("Ảnh gửi lên không hợp lệ. Hãy chọn JPEG hoặc PNG.");
    if (response.status === 413) throw new Error("Ảnh vượt quá giới hạn 5 MB.");
    throw new Error(result.error === "inference_failed" ? "Bộ nhận diện đang gặp sự cố." : `Backend trả về HTTP ${response.status}.`);
  }
  lastDetections = Array.isArray(result.detections) ? result.detections : [];
  lastImageWidth = result.image_width;
  lastImageHeight = result.image_height;
  resizeOverlay();
  updateSummary(lastDetections);
  statusText.textContent = `${lastDetections.length} vật thể · ${result.inference_ms} ms.`;
}

async function handlePhoto(file) {
  if (!file) return;
  if (requestInProgress) return;
  requestInProgress = true;
  try {
    if (snapshotUrl) URL.revokeObjectURL(snapshotUrl);
    snapshotUrl = URL.createObjectURL(file);
    snapshot.src = snapshotUrl;
    snapshot.hidden = false;
    video.hidden = true;
    await snapshot.decode();
    resizeOverlay();
    await submitImage(file, file.name || "photo.jpg");
  } catch (error) {
    statusText.textContent = error.message || "Không đọc được ảnh đã chụp.";
  } finally {
    requestInProgress = false;
    photoInput.value = "";
  }
}

async function startCamera() {
  if (!window.isSecureContext) {
    statusText.textContent = "Camera điện thoại chỉ hoạt động trên HTTPS hoặc localhost. Hãy mở link HTTPS của tunnel.";
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    statusText.textContent = "Trình duyệt này không hỗ trợ camera. Hãy dùng nút Chụp 1 ảnh.";
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    video.srcObject = stream;
    await video.play();
    video.hidden = false;
    snapshot.hidden = true;
    resizeOverlay();
    startButton.disabled = true;
    stopButton.disabled = false;
    statusText.textContent = "Camera đã bật; đang nhận diện.";
    timer = window.setInterval(sendFrame, SEND_INTERVAL_MS);
  } catch (error) {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    statusText.textContent = error.name === "NotAllowedError" || error.name === "PermissionDeniedError"
      ? "Bạn chưa cấp quyền camera. Hãy cho phép camera trong trình duyệt rồi thử lại."
      : "Không mở được camera. Kiểm tra thiết bị, quyền truy cập và dùng localhost hoặc HTTPS.";
  }
}

function stopCamera() {
  window.clearInterval(timer);
  timer = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  lastDetections = [];
  startButton.disabled = false;
  stopButton.disabled = true;
  statusText.textContent = "Camera đã dừng.";
}

startButton.addEventListener("click", startCamera);
stopButton.addEventListener("click", stopCamera);
photoButton.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", () => handlePhoto(photoInput.files?.[0]));
window.addEventListener("resize", resizeOverlay);
window.addEventListener("orientationchange", () => window.setTimeout(resizeOverlay, 150));
video.addEventListener("loadedmetadata", resizeOverlay);
snapshot.addEventListener("load", resizeOverlay);

