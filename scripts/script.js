const landscapeContainer = document.getElementById("landscape");
const positionElement = document.getElementById("currentPosition");

// Fixed landscape data
const landscapeData = [20, 60, 80, 40, 100, 50, 90, 20, 120, 30, 70, 85, 40, 65, 90, 125, 75, 55, 80, 40];

// Create the landscape
function createLandscape() {
  const landscapeWidth = 600;
  const landscapeHeight = 200;
  const segmentWidth = landscapeWidth / (landscapeData.length - 1);

  const landscapePath = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  landscapePath.setAttribute("width", landscapeWidth);
  landscapePath.setAttribute("height", landscapeHeight);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", generateLinePath());
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#3e8e41");
  path.setAttribute("stroke-width", "2");

  landscapePath.appendChild(path);
  landscapeContainer.appendChild(landscapePath);
}

// Generate the line path for the landscape
function generateLinePath() {
  let d = `M0,${200 - landscapeData[0]}`;
  for (let i = 1; i < landscapeData.length; i++) {
    d += ` L${i * (600 / (landscapeData.length - 1))},${200 - landscapeData[i]}`;
  }
  return d;
}

// Update the position marker
function updateMarkerPosition(index) {
  positionElement.style.left = `${index * (600 / (landscapeData.length - 1))}px`;
  positionElement.style.top = `${200 - landscapeData[index]}px`;
}

// Start the local search
function startLocalSearch() {
  let currentIndex = 0;

  const searchInterval = setInterval(() => {
    const currentHeight = landscapeData[currentIndex];
    const leftNeighbor = landscapeData[currentIndex - 1] || 0;
    const rightNeighbor = landscapeData[currentIndex + 1] || 0;

    // Move to higher neighbor if one exists
    if (currentHeight < 125) {
      currentIndex += 1;
    } else {
      clearInterval(searchInterval);
    }

    updateMarkerPosition(currentIndex);
  }, 500); // Adjust timing if needed
}

// Create the initial landscape
createLandscape();

// Add a button to start the local search
const searchButton = document.createElement("button");
searchButton.textContent = "Start Local Search";
searchButton.addEventListener("click", startLocalSearch);
document.querySelector(".search-container").appendChild(searchButton);