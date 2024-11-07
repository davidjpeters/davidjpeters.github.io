const paths = [
    "M 110 280 L 300 280",
    "M 300 280 L 500 280",
    "M 300 280 L 300 450",
    "M 500 280 L 500 450"
];

function createDot() {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("r", "4");
    dot.classList.add("power-dot");
    return dot;
}

function animateDot(dot, path, delay = 0) {
    const length = path.getTotalLength();
    let start = null;
    const duration = 2000; // Animation duration in ms

    function animate(timestamp) {
        if (!start) start = timestamp;
        const progress = (timestamp - start) / duration;
        
        if (progress <= 1) {
            const point = path.getPointAtLength(length * progress);
            dot.setAttribute("cx", point.x);
            dot.setAttribute("cy", point.y);
            requestAnimationFrame(animate);
        } else {
            dot.remove();
            // Create new dot for continuous animation
            const newDot = createDot();
            document.getElementById("powerDots").appendChild(newDot);
            setTimeout(() => animateDot(newDot, path), 0);
        }
    }

    setTimeout(() => requestAnimationFrame(animate), delay);
}

// Initialize animations for each path
paths.forEach((pathData, index) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.style.display = "none";
    document.querySelector("svg").appendChild(path);

    // Create multiple dots per path with different delays
    for (let i = 0; i < 3; i++) {
        const dot = createDot();
        document.getElementById("powerDots").appendChild(dot);
        animateDot(dot, path, i * 666); // Stagger the dots
    }
});