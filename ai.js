async function processImageWithAI(imageDataUrl) {
  try {
    const rulesEl = document.getElementById("rules");
    if (rulesEl) {
      rulesEl.innerHTML = `<span class="info-text">🤖 Scanning tiles with custom YOLO model...</span>`;
    }

    const res = await fetch(imageDataUrl);
    const blob = await res.blob();

    const formData = new FormData();
    formData.append("file", blob, "hand.jpg");

    const response = await fetch("/scan-hand", {
      method: "POST",
      body: formData
    });

    const data = await response.json();
    const detectedTiles = data.tiles || [];

    if (typeof window.markHandScanned === "function") {
      window.markHandScanned(imageDataUrl);
    }

    if (detectedTiles.length > 0) {
      if (typeof window.clearHand === 'function') window.clearHand();
      detectedTiles.forEach(tilePath => {
        if (typeof window.addTile === 'function') window.addTile(tilePath);
      });
    } else {
      alert("No tiles recognized automatically. You can adjust lighting/angle or tap tiles manually to fix the scanned hand.");
      if (typeof calculateScore === 'function') calculateScore();
    }

  } catch (err) {
    console.error("Local Vision Server Error:", err);
    alert("Could not connect to local vision server. Ensure python backend is running.");
    if (typeof calculateScore === 'function') calculateScore();
  }
}

// --- Native Camera Integration ---
const openCameraBtn = document.getElementById("openCameraBtn");
const nativeCameraInput = document.getElementById("nativeCameraInput");

if (openCameraBtn && nativeCameraInput) {
  openCameraBtn.addEventListener("click", () => {
    // Opens the phone's native camera app directly
    nativeCameraInput.click();
  });

  nativeCameraInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Read the captured photo file as a Data URL
    const reader = new FileReader();
    reader.onload = async function(event) {
      const imageDataUrl = event.target.result;
      // Send it off to your YOLO AI scanner function
      await processImageWithAI(imageDataUrl);
    };
    reader.readAsDataURL(file);

    // Reset input so the user can take another photo of the same hand if needed
    nativeCameraInput.value = "";
  });
}