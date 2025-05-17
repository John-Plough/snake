// game.js
import { API_BASE } from "./config.js";

// ─── Configuration ────────────────────────────────────────────────────────────

// ─── API Helper ───────────────────────────────────────────────────────────────

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
}

async function submitScore(scoreValue) {
  try {
    const csrfToken = getCookie("CSRF-TOKEN");
    const headers = {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    };

    const resp = await fetch(`${API_BASE}/scores`, {
      method: "POST",
      headers: headers,
      credentials: "include",
      body: JSON.stringify({ score: { value: scoreValue } }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Failed to save score", data.error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error saving score:", error);
    return null;
  }
}

// ─── Canvas Setup ────────────────────────────────────────────────────────────

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const modal = document.getElementById("gameOverModal");
const finalScoreElement = document.getElementById("finalScore");
const closeModalButton = document.getElementById("closeModal");

canvas.width = 450; // 15 cols × 30px
canvas.height = 510; // 17 rows × 30px

// ─── Game Constants & Assets ─────────────────────────────────────────────────

const gridWidth = 15,
  gridHeight = 17,
  tileSize = 30;

const flowerColors = ["blue", "green", "lavender", "pink", "purple", "turquoise", "yellow"];
const flowerImages = {},
  beeImage = new Image(),
  potImage = new Image();

beeImage.src = "images/bee.png";
potImage.src = "images/pot1.png";

flowerColors.forEach((color) => {
  flowerImages[color] = new Image();
  flowerImages[color].src = `images/${color}.png`;
});

// ─── Game State ──────────────────────────────────────────────────────────────

let snake = null,
  food = null,
  dx = 0,
  dy = 0,
  score = 0,
  gameInterval = null,
  gameSpeed = 200,
  baseSpeed = 200,
  gameRunning = false,
  gameStarted = false,
  isPaused = false,
  canCloseModal = false;

// ─── Audio Setup ──────────────────────────────────────────────────────────────

const backgroundMusic = new Audio("audio/BuzzingDance.mp3");
backgroundMusic.loop = true; // Make the music loop
const flowerSound = new Audio("audio/FlowerSound.mp3");
const gameOverSound = new Audio("audio/GameOverSound.mp3");

// Adjust volume levels
backgroundMusic.volume = 0.5; // Background music at 50% volume
flowerSound.volume = 0.2; // Flower sound at 70% volume
gameOverSound.volume = 0.7; // Game over sound at full volume

// Audio control state
let isMusicEnabled = true;
let areSoundEffectsEnabled = true;

// Set up audio control listeners
document.getElementById("musicToggle").addEventListener("change", (e) => {
  isMusicEnabled = e.target.checked;
  if (isMusicEnabled) {
    if (gameStarted && !isPaused && gameRunning) {
      backgroundMusic.play();
    }
  } else {
    backgroundMusic.pause();
  }
});

document.getElementById("soundEffectsToggle").addEventListener("change", (e) => {
  areSoundEffectsEnabled = e.target.checked;
});

// Update existing audio playing functions
function playBackgroundMusic() {
  if (isMusicEnabled) {
    backgroundMusic.play();
  }
}

function playFlowerSound() {
  if (areSoundEffectsEnabled) {
    flowerSound.play();
  }
}

function playGameOverSound() {
  if (areSoundEffectsEnabled) {
    gameOverSound.play();
  }
}

// ─── Image Loader ────────────────────────────────────────────────────────────

let loadedImages = 0,
  totalImages = Object.keys(flowerImages).length + 2,
  allImagesLoaded = false;

function checkAllImagesLoaded() {
  loadedImages++;
  if (loadedImages === totalImages) {
    allImagesLoaded = true;
    initGame();
    draw();
  }
}

Object.values(flowerImages).forEach((img) => (img.onload = checkAllImagesLoaded));
beeImage.onload = checkAllImagesLoaded;
potImage.onload = checkAllImagesLoaded;

// ─── Game Initialization ──────────────────────────────────────────────────────

export function initGame() {
  // Place bee in the middle of the board
  snake = [{ x: Math.floor(gridWidth / 2), y: Math.floor(gridHeight / 2) }];
  food = null; // Don't generate food until first move
  dx = dy = 0;
  score = 0;
  gameSpeed = baseSpeed;

  // Update score display with username
  updateScore();

  gameRunning = true;
  gameStarted = false;
  isPaused = false;

  // Reset audio
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  backgroundMusic.playbackRate = 1.0;

  draw();
}

// Update the score display function
function updateScore() {
  const usernameDisplay = document.querySelector(".username-display");
  const usernameElement = document.querySelector(".username");

  // Get the username from the auth element and update display
  if (usernameDisplay) {
    let displayName = "Guest";
    if (usernameElement && usernameElement.textContent.trim()) {
      displayName = usernameElement.textContent.trim();
    }
    usernameDisplay.textContent = displayName;
  }

  const scoreValue = document.querySelector(".score-value");
  if (scoreValue) {
    scoreValue.textContent = score;
  }
}

// Listen for username updates from auth system
document.addEventListener("usernameUpdated", (event) => {
  const usernameDisplay = document.querySelector(".username-display");
  if (usernameDisplay) {
    usernameDisplay.textContent = event.detail;
  }
});

// Add event listener for auth changes
document.addEventListener("DOMContentLoaded", () => {
  // Initial update of the score display
  updateScore();
});

// ─── Food Generation ─────────────────────────────────────────────────────────

function generateFood() {
  let f;
  do {
    f = {
      x: Math.floor(Math.random() * gridWidth),
      y: Math.floor(Math.random() * gridHeight),
      color: flowerColors[Math.floor(Math.random() * flowerColors.length)],
    };
  } while (snake.some((seg) => seg.x === f.x && seg.y === f.y));
  return f;
}

// ─── Drawing Helpers ─────────────────────────────────────────────────────────

function drawFlower(x, y, color) {
  ctx.drawImage(flowerImages[color], x * tileSize, y * tileSize, tileSize, tileSize);
}

function drawBee(x, y) {
  ctx.drawImage(beeImage, x * tileSize, y * tileSize, tileSize, tileSize);
}

function drawHoneyPot(x, y) {
  ctx.drawImage(potImage, x * tileSize, y * tileSize, tileSize, tileSize);
}

// ─── Main Draw ──────────────────────────────────────────────────────────────

function draw() {
  if (!allImagesLoaded || !snake) return;

  // Clear the canvas
  ctx.fillStyle = "#d7eeee";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw snake (bee and honey pots)
  snake.forEach((seg, i) => {
    if (i === 0) drawBee(seg.x, seg.y);
    else drawHoneyPot(seg.x, seg.y);
  });

  // Draw food (flower) if it exists
  if (food) {
    drawFlower(food.x, food.y, food.color);
  }

  // Draw pause overlay if game is paused
  if (isPaused && gameStarted) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "30px Quicksand";
    ctx.textAlign = "center";
    ctx.fillText("PAUSED", canvas.width / 2, canvas.height / 2);
    ctx.font = "20px Quicksand";
    ctx.fillText("Press SPACE to resume", canvas.width / 2, canvas.height / 2 + 40);
  }
}

// ─── Game Update ────────────────────────────────────────────────────────────

function update() {
  const head = { x: snake[0].x + dx, y: snake[0].y + dy };

  // Wall collision
  if (head.x < 0 || head.x >= gridWidth || head.y < 0 || head.y >= gridHeight) {
    gameOver();
    return;
  }
  // Self collision
  if (snake.some((seg) => seg.x === head.x && seg.y === head.y)) {
    gameOver();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 1;
    updateScore();
    food = generateFood();
    playFlowerSound();

    // Increase speed by 5%
    gameSpeed = Math.floor(baseSpeed / (1 + score * 0.05));

    // Only increase music speed by 3% after 6 pots
    if (score >= 6 && isMusicEnabled) {
      backgroundMusic.playbackRate = 1 + (score - 6) * 0.03;
    }

    // Update the game interval with new speed
    if (gameInterval) {
      clearInterval(gameInterval);
      gameInterval = setInterval(gameLoop, gameSpeed);
    }
  } else {
    snake.pop();
  }
}

// ─── Game Loop & Input ─────────────────────────────────────────────────────

function gameLoop() {
  if (!gameRunning) return;
  update();
  draw();
}

function handleKeyPress(e) {
  // Handle Enter key for game restart when modal is shown
  if (e.code === "Enter" && !gameRunning && modal.classList.contains("show")) {
    if (canCloseModal) {
      modal.classList.remove("show");
      initGame();
    }
    return;
  }

  // Handle spacebar for pause
  if (e.code === "Space" && gameStarted && gameRunning) {
    e.preventDefault();
    isPaused = !isPaused;
    if (isPaused) {
      clearInterval(gameInterval);
      backgroundMusic.pause(); // Pause music when game is paused
    } else {
      gameInterval = setInterval(gameLoop, gameSpeed);
      playBackgroundMusic(); // Use the new function instead of direct play
    }
    draw();
    return;
  }

  // Check if it's an arrow key
  if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    return;
  }

  // Prevent default browser scrolling behavior for arrow keys
  e.preventDefault();

  // If game is over, only restart if modal can be closed
  if (!gameRunning) {
    if (canCloseModal) {
      modal.classList.remove("show");
      initGame();
    }
    return;
  }

  // Don't process movement if game is paused
  if (isPaused) return;

  let [newDx, newDy] = [dx, dy];

  switch (e.key) {
    case "ArrowUp":
      if (dy !== 1) [newDx, newDy] = [0, -1];
      break;
    case "ArrowDown":
      if (dy !== -1) [newDx, newDy] = [0, 1];
      break;
    case "ArrowLeft":
      if (dx !== 1) [newDx, newDy] = [-1, 0];
      break;
    case "ArrowRight":
      if (dx !== -1) [newDx, newDy] = [1, 0];
      break;
  }

  // Generate first food and start game loop on first valid key press
  if (!gameStarted && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    gameStarted = true;
    food = generateFood();
    gameInterval = setInterval(gameLoop, gameSpeed);
    playBackgroundMusic(); // Use the new function instead of direct play
  }
  [dx, dy] = [newDx, newDy];
}

// ─── Game Over Handler ─────────────────────────────────────────────────────

async function gameOver() {
  gameRunning = false;
  clearInterval(gameInterval);

  // Clear any existing messages in the modal
  const modalContent = modal.querySelector(".modal-content");
  while (modalContent.children.length > 1) {
    // Keep only the h2 "Game Over"
    modalContent.removeChild(modalContent.lastChild);
  }

  // Add the final score message
  finalScoreElement.textContent = `You created ${score} pots of honey!`;
  modalContent.appendChild(finalScoreElement);
  canCloseModal = false;

  // Handle audio
  backgroundMusic.pause();
  backgroundMusic.currentTime = 0;
  playGameOverSound();

  // Send final score to backend
  const response = await submitScore(score);
  console.log("Score submission response:", JSON.stringify(response, null, 2));

  try {
    const csrfToken = getCookie("CSRF-TOKEN");

    // Get personal scores to check if this is highest
    const personalResponse = await fetch(`${API_BASE}/scores/personal`, {
      credentials: "include",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
    });

    if (personalResponse.ok) {
      const personalScores = await personalResponse.json();
      console.log("Personal scores:", personalScores);

      if (personalScores.length >= 3) {
        // Filter out the current score (using the response id) and find the highest previous score
        const previousScores = personalScores.filter((s) => s.id !== response.id);
        const highestPreviousScore = Math.max(...previousScores.map((s) => s.value));
        console.log("Highest previous score:", highestPreviousScore);
        console.log("Current score:", score);

        // Check if current score is greater than the highest previous score
        if (score > highestPreviousScore) {
          const highScoreMessage = document.createElement("p");
          highScoreMessage.textContent = "That's your highest score ever!";
          highScoreMessage.style.color = "#2e7d32"; // Success green color
          highScoreMessage.style.marginTop = "1rem";
          highScoreMessage.style.fontWeight = "600";
          modalContent.appendChild(highScoreMessage);
        }
      }
    }

    // Get global scores to determine rank
    const globalResponse = await fetch(`${API_BASE}/scores/global`, {
      credentials: "include",
      headers: {
        "X-CSRF-Token": csrfToken,
      },
    });

    if (globalResponse.ok) {
      const globalScores = await globalResponse.json();
      // Find the rank of the current score
      const currentScoreId = response.id;
      const rank = globalScores.findIndex((s) => s.id === currentScoreId) + 1;

      if (rank > 0 && rank <= 6) {
        // Create and add the rank message
        const rankMessage = document.createElement("p");
        rankMessage.textContent = `Congratulations! You are now #${rank} on the global leaderboard.`;
        rankMessage.style.color = "#2e7d32"; // Success green color
        rankMessage.style.marginTop = "1rem";
        rankMessage.style.fontWeight = "600";
        modalContent.appendChild(rankMessage);
      }
    }
  } catch (error) {
    console.error("Error fetching scores:", error);
  }

  // Add the buttons container
  const modalButtons = document.createElement("div");
  modalButtons.className = "modal-buttons";

  // Create Play Again button
  const playAgainButton = document.createElement("button");
  playAgainButton.textContent = "Play Again";
  playAgainButton.addEventListener("click", () => {
    if (canCloseModal) {
      modal.classList.remove("show");
      initGame();
    }
  });

  // Create Close button
  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => {
    if (canCloseModal) {
      modal.classList.remove("show");
    }
  });

  // Add buttons to container
  modalButtons.appendChild(playAgainButton);
  modalButtons.appendChild(closeButton);
  modalContent.appendChild(modalButtons);

  // Show the modal
  modal.classList.add("show");

  // Allow modal to be closed after 2 seconds
  setTimeout(() => {
    canCloseModal = true;
  }, 2000);
}

// ─── Modal Close ────────────────────────────────────────────────────────────

function closeModal(shouldRestart = false) {
  if (!canCloseModal) return; // Prevent early closing
  modal.classList.remove("show");
  if (shouldRestart) {
    initGame();
  }
}

// ─── Event Listeners & Initial Draw ────────────────────────────────────────

document.addEventListener("keydown", handleKeyPress);
document.getElementById("closeModal")?.removeEventListener("click", () => closeModal(true));
document.getElementById("closeGameOverModal")?.removeEventListener("click", () => closeModal(false));

// Instructions modal handlers
const instructionsModal = document.getElementById("instructionsModal");
const instructionsButton = document.getElementById("instructionsButton");
const closeInstructionsModal = document.getElementById("closeInstructionsModal");

instructionsButton.addEventListener("click", () => {
  instructionsModal.classList.remove("hidden");
  instructionsModal.classList.add("show");
});

closeInstructionsModal.addEventListener("click", () => {
  instructionsModal.classList.remove("show");
  instructionsModal.classList.add("hidden");
});

// Close instructions modal when clicking outside
instructionsModal.addEventListener("click", (event) => {
  if (event.target === instructionsModal) {
    instructionsModal.classList.remove("show");
    instructionsModal.classList.add("hidden");
  }
});

// Initialize game on page load
initGame();
draw();
