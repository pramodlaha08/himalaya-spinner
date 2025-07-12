const studentCountInput = document.getElementById("studentCount");
const startButton = document.getElementById("startButton");
const resultDiv = document.getElementById("result");
const winnerNumberSpan = document.getElementById("winnerNumber");
const cheerSound = document.getElementById("cheerSound");
const confettiContainer = document.querySelector(".confetti-container");

// Modal elements
const winnerModal = document.getElementById("winnerModal");
const modalWinnerNumber = document.getElementById("modalWinnerNumber");
const closeModal = document.getElementById("closeModal"); // Keep as per your code
const closeModalBtn = document.getElementById("closeModalBtn"); // Keep as per your code
const newDrawButton = document.getElementById("newDrawButton");

// NEW GLOBAL VARIABLES for non-repetitive winners
let recentWinners = [];
const MAX_RECENT_WINNERS_HISTORY = 20; // Keep track of the last 20 winners

// Get references to all three canvases
const spinnerCanvases = [
    document.getElementById("spinnerCanvas1"),
    document.getElementById("spinnerCanvas2"),
    document.getElementById("spinnerCanvas3"),
];
const spinnerContexts = spinnerCanvases.map((canvas) =>
    canvas.getContext("2d")
);

// NEW: Get reference to the spin sound audio element
const spinSound = document.getElementById("spinSound");


let spinning = false; // To prevent multiple spins

// Function to draw a single spinner wheel with given segments
function drawSpinner(canvas, segmentsToDraw) {
    const ctx = canvas.getContext("2d");
    canvas.segments = segmentsToDraw; // Store segments directly on the canvas element for later use

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawing
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 25; // Padding from edge
    const arcAngle = (2 * Math.PI) / segmentsToDraw.length; // Angle in radians

    for (let i = 0; i < segmentsToDraw.length; i++) {
        const startAngle = i * arcAngle;
        const endAngle = (i + 1) * arcAngle;

        // Create gradient colors for a more modern look
        const gradient = ctx.createLinearGradient(
            centerX - radius,
            centerY - radius,
            centerX + radius,
            centerY + radius
        );
        const hue = (i * 360) / segmentsToDraw.length;
        gradient.addColorStop(0, `hsl(${hue}, 70%, 75%)`);
        gradient.addColorStop(1, `hsl(${hue}, 70%, 65%)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#ffffff"; // White border between segments
        ctx.lineWidth = 2;
        ctx.stroke();

        // Add numbers/labels to segments with better positioning for smaller canvas
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + arcAngle / 2 + Math.PI / 2);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#333";
        ctx.font = "bold 28px Poppins, Arial"; // Smaller font for 220px canvas

        ctx.fillText(segmentsToDraw[i], 0, -radius * 0.6); // Negative Y because of rotation.

        ctx.restore();
    }
}

// Function to initialize/redraw all spinners based on total student count
function initializeSpinners() {
    const maxStudents = parseInt(studentCountInput.value);

    // First spinner (Hundreds) will always have 10 segments alternating '0' and '1'
    const hundredsSegments = ["0", "1", "0", "1", "0", "1", "0", "1", "0", "1"];

    // Tens and Units spinners always have 0-9
    const tensAndUnitsSegments = Array.from({ length: 10 }, (_, i) => String(i));

    drawSpinner(spinnerCanvases[0], hundredsSegments); // Spinner 1 (Hundreds)
    drawSpinner(spinnerCanvases[1], tensAndUnitsSegments); // Spinner 2 (Tens)
    drawSpinner(spinnerCanvases[2], tensAndUnitsSegments); // Spinner 3 (Units)
}

// Helper function to perform a single spinner's animation to a specific target digit
// MODIFIED: Now correctly accepts and USES spinDuration and rotations parameters
function performSpin(canvas, targetDigit, spinDuration, rotations) { // <-- Added parameters here
    return new Promise((resolve) => {
        const numSegments = canvas.segments.length;
        // REMOVED: Hardcoded spinDuration and rotations, now using parameters
        // const spinDuration = 22000;
        // const rotations = 20;

        const targetIndex = canvas.segments.indexOf(String(targetDigit));

        console.log(`--- Spin Request for ${canvas.id} ---`);
        console.log(`  Target Digit: ${targetDigit}`);
        console.log(`  Target Index (in segments): ${targetIndex}`);
        console.log(`  Available Segments: [${canvas.segments.join(", ")}]`);
        if (targetIndex === -1) {
            console.error(
                `ERROR: Target digit '${targetDigit}' not found in segments for ${canvas.id}. This will cause incorrect landing.`
            );
            let fallbackIndex = 0;
            if (canvas.segments.includes("0"))
                fallbackIndex = canvas.segments.indexOf("0");
            console.error(`  Defaulting targetIndex to ${fallbackIndex}.`);
            targetIndex = fallbackIndex;
        }

        const segmentAngleDegrees = 360 / numSegments;
        const targetSegmentCenterAngle =
            targetIndex * segmentAngleDegrees + segmentAngleDegrees / 2;

        const desiredLandingAngle = 270;
        let rotationNeeded = desiredLandingAngle - targetSegmentCenterAngle;
        rotationNeeded = ((rotationNeeded % 360) + 360) % 360;

        let finalRotationAngle = rotations * 360 + rotationNeeded; // <-- Uses 'rotations' parameter

        canvas.style.transition = `transform ${spinDuration / 1000
            }s cubic-bezier(0.25, 0.1, 0.25, 1)`; // <-- Uses 'spinDuration' parameter
        canvas.style.transform = `translate(-50%, -50%) rotate(${finalRotationAngle}deg)`;

        setTimeout(() => {
            canvas.style.transition = "none";
            canvas.style.transform = `translate(-50%, -50%) rotate(${finalRotationAngle % 360
                }deg)`;
            resolve(targetDigit);
        }, spinDuration); // <-- Uses 'spinDuration' parameter
    });
}

// Main function to orchestrate all spins
async function spinAllWheels() {
    if (spinning) return;
    spinning = true;
    resultDiv.classList.add("hidden");
    // MODIFIED: Ensure modal is hidden using style.display before spin
    winnerModal.style.display = "none";
    startButton.disabled = true;

    let totalStudents = parseInt(studentCountInput.value);
    if (isNaN(totalStudents) || totalStudents < 1 || totalStudents > 999) {
        alert("Please enter a valid number of students between 1 and 999.");
        spinning = false;
        startButton.disabled = false;
        return;
    }

    initializeSpinners();

    let randomWinner;
    let attempts = 0;
    const MAX_ROLL_ATTEMPTS = 500; // Safety limit to prevent infinite loops

    const effectiveHistorySize = Math.min(
        MAX_RECENT_WINNERS_HISTORY,
        totalStudents
    );
    const recentWinnersSet = new Set(recentWinners);

    if (recentWinnersSet.size === effectiveHistorySize && totalStudents > 0) {
        let allPossibleStudentsInHistory = true;
        if (totalStudents <= MAX_RECENT_WINNERS_HISTORY) {
            for (let i = 1; i <= totalStudents; i++) {
                if (!recentWinnersSet.has(i)) {
                    allPossibleStudentsInHistory = false;
                    break;
                }
            }
        } else {
            allPossibleStudentsInHistory = false;
        }

        if (allPossibleStudentsInHistory) {
            console.warn(
                `All ${totalStudents} possible students have been drawn within recent history. Resetting unique history for a new cycle.`
            );
            recentWinners = []; // Reset the history to start fresh
            recentWinnersSet.clear(); // Clear the set as well
        }
    }

    // Loop to find a non-repetitive winner
    do {
        randomWinner = Math.floor(Math.random() * totalStudents) + 1;
        attempts++;

        if (attempts > MAX_ROLL_ATTEMPTS) {
            console.warn(
                `Exceeded ${MAX_ROLL_ATTEMPTS} attempts to find a unique winner. Allowing a repeat for this draw.`
            );
            break; // Break the loop, use the current randomWinner (which might be a repeat)
        }
    } while (recentWinnersSet.has(randomWinner));

    // Add the newly found winner to the history
    recentWinners.push(randomWinner);

    // Trim the history to the maximum desired size
    if (recentWinners.length > MAX_RECENT_WINNERS_HISTORY) {
        recentWinners.shift(); // Remove the oldest winner from the beginning of the array
    }

    console.log("Recent Winners History:", recentWinners); // For debugging purposes

    // Calculate digits from the determined randomWinner
    const hundredsDigit = Math.floor(randomWinner / 100);
    const tensDigit = Math.floor((randomWinner % 100) / 10);
    const unitsDigit = randomWinner % 10; // Corrected from % 0 to % 10

    console.log(`\n--- Spin Start ---`);
    console.log(`Winning Number (randomWinner): ${randomWinner}`);
    console.log(
        `Calculated Digits: Hundreds=${hundredsDigit}, Tens=${tensDigit}, Units=${unitsDigit}`
    );

    // Define specific durations and rotations for each spinner
    // Units digit stops at 20s, Tens at 30s, Hundreds at 40s
    const duration3 = 20000; // 20 seconds for Units (last digit)
    const rotations3 = 20;   // Rotations for 20 seconds

    const duration2 = 30000; // 30 seconds for Tens (second digit)
    const rotations2 = 30;   // Rotations for 30 seconds

    const duration1 = 40000; // 40 seconds for Hundreds (first digit)
    const rotations1 = 40;   // Rotations for 40 seconds

    // Play the spin sound BEFORE starting the spins
    if (spinSound) {
        spinSound.play().catch(e => console.error("Error playing spin sound:", e));
    }

    const spinPromises = [
        performSpin(spinnerCanvases[0], hundredsDigit, duration1, rotations1), // Pass duration and rotations
        performSpin(spinnerCanvases[1], tensDigit, duration2, rotations2),     // Pass duration and rotations
        performSpin(spinnerCanvases[2], unitsDigit, duration3, rotations3),   // Pass duration and rotations
    ];

    await Promise.all(spinPromises);

    // Pause the spin sound AFTER all spins are complete
    if (spinSound) {
        spinSound.pause();
        spinSound.currentTime = 0; // Reset sound to beginning for next spin
    }

    // Update both the hidden result div and modal
    winnerNumberSpan.textContent = randomWinner;
    modalWinnerNumber.textContent = String(randomWinner).padStart(3, "0");

    // Show the modal using style.display to match your CSS
    showWinnerModal();

    // Play sound and confetti
    cheerSound.play();

    // Call triggerCelebrationEffects if it's defined and you want it enabled.
    // This assumes triggerCelebrationEffects is defined later in your script.
    if (typeof triggerCelebrationEffects === "function") {
        triggerCelebrationEffects();
    } else {
        // Original fallback confetti logic, if triggerCelebrationEffects is not defined
        const colors = ["#00529C", "#128DB8", "#F36F21", "#4A90B8", "#FF8C42"];
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement("div");
            confetti.classList.add("confetti"); // Requires .confetti CSS
            confetti.style.left = `${Math.random() * 100}%`;
            confetti.style.animationDelay = `${Math.random() * 1.5}s`;
            confetti.style.backgroundColor =
                colors[Math.floor(Math.random() * colors.length)];
            confetti.style.width = `${Math.random() * 8 + 5}px`;
            confetti.style.height = confetti.style.width;
            confetti.style.borderRadius = `${Math.random() > 0.5 ? "50%" : "0"}`;
            confettiContainer.appendChild(confetti);
            confetti.addEventListener("animationend", () => confetti.remove());
        }
    }

    spinning = false;
    startButton.disabled = false;
}

// Modal functions
// MODIFIED: Use style.display to match your CSS for .modal
function showWinnerModal() {
    winnerModal.style.display = "flex"; // Use 'flex' to enable centering via CSS
    document.body.style.overflow = "hidden"; // Prevent background scrolling
}

// MODIFIED: Use style.display to match your CSS for .modal
function hideWinnerModal() {
    winnerModal.style.display = "none";
    document.body.style.overflow = "auto"; // Restore scrolling
    // Clear any existing confetti
    while (confettiContainer.firstChild) {
        confettiContainer.removeChild(confettiContainer.firstChild);
    }
}

function resetForNewDraw() {
    hideWinnerModal();
    resultDiv.classList.add("hidden");
    // Clear any existing confetti
    while (confettiContainer.firstChild) {
        confettiContainer.removeChild(confettiContainer.firstChild);
    }
}

// Initial draw of all spinners when the page loads
initializeSpinners();

// Event Listeners
startButton.addEventListener("click", spinAllWheels);

// Modal event listeners (using original IDs from your code)
closeModal.addEventListener("click", hideWinnerModal);
closeModalBtn.addEventListener("click", hideWinnerModal);
newDrawButton.addEventListener("click", resetForNewDraw);

// Close modal when clicking outside of it
winnerModal.addEventListener("click", (event) => {
    if (event.target === winnerModal) {
        hideWinnerModal();
    }
});

// Close modal with Escape key
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && winnerModal.style.display === "flex") { // Check for 'flex' display
        hideWinnerModal();
    }
});

studentCountInput.addEventListener("change", () => {
    let value = parseInt(studentCountInput.value);
    if (isNaN(value) || value < 1) {
        studentCountInput.value = 1;
    } else if (value > 999) {
        studentCountInput.value = 999;
    }
    initializeSpinners();
});

// IMPORTANT: Assuming triggerCelebrationEffects is defined later, or this is your intended confetti logic.
// If you have a separate triggerCelebrationEffects function, ensure it's present.
function triggerCelebrationEffects() {
    // This is the enhanced confetti code with college theme colors.
    while (confettiContainer.firstChild) {
        confettiContainer.removeChild(confettiContainer.lastChild);
    }
    const colors = [
        "#00529C",
        "#128DB8",
        "#F36F21",
        "#4A90B8",
        "#FF8C42",
        "#003F72",
        "#1AA3D1",
        "#FFB366",
        "#0066CC",
        "#FF6633",
    ];
    for (let i = 0; i < 70; i++) {
        // Generate 70 confetti particles
        const confetti = document.createElement("div");
        confetti.classList.add("confetti");
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.animationDelay = `${Math.random() * 1.5}s`; // Stagger animation start
        confetti.style.backgroundColor =
            colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = `${Math.random() * 8 + 5}px`; // Random size
        confetti.style.height = confetti.style.width;
        confetti.style.borderRadius = `${Math.random() > 0.5 ? "50%" : "0"}`; // Some squares, some circles

        confettiContainer.appendChild(confetti);

        confetti.addEventListener("animationend", () => {
            confetti.remove();
        });
    }
}
