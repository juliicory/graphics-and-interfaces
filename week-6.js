
// ------------------------------------------------------------
// Button
// ------------------------------------------------------------

let volSum = 0;

const button = document.createElement("button");
button.type = "button";
button.textContent = `volume: ${volSum}`;
const audio = new Audio("hatemusic.mp3");
audio.loop = true;

// Try to play on page open; browsers may block autoplay until the user interacts,
// so fall back to starting on the first click/key press.
audio.play().catch(() => {
    const start = () => {
        audio.play();
        window.removeEventListener("pointerdown", start);
        window.removeEventListener("keydown", start);
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
});

// Centered on the page, above the canvas but below the week menu.
Object.assign(button.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: "10",
    padding: "14px 32px",
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "8px",
    color: "#fff",
    fontFamily: "sans-serif",
    fontSize: "18px",
    cursor: "pointer",
});

let volumeOptions = [];
let volumeSelect = [];

button.addEventListener("mouseenter", () => {
    button.style.background = "rgba(255, 255, 255, 0.2)";
});

button.addEventListener("mouseleave", () => {
    button.style.background = "rgba(255, 255, 255, 0.1)";
});


// ------------------------------------------------------------
// Click
// ------------------------------------------------------------

let clicks = 0;

button.addEventListener("click", () => {
    clicks++;
    volumeOptions = [];

    // create volume texts
    for (let j = 0; j < 20; j++) {

        let i = parseInt(Math.random() * 100);

        const newElement = document.createElement("p");
        newElement.textContent = `${i}`;
        newElement.style.color = "#fff";
        newElement.style.fontSize = "36px";
        newElement.style.fontFamily = "sans-serif";

        // make it clickable
        newElement.addEventListener("click", () => {

            if (volumeSelect.length >= 4) {
                // reset all to 0
                volumeSelect = [];
                volSum = 0;
                audio.volume = 0.5;
                button.textContent = `volume: ${volSum}`;

                // set other elemnts back to white 
                volumeOptions.forEach((el) => {
                    el.style.color = "#fff";
                    el.style.fontWeight = "normal";
                });
            }
            else {
                // change color indicator 
                newElement.style.color = "rgb(255, 76, 136)";
                newElement.style.fontWeight = "bold";
                volumeSelect.push(i);
            }

            // audio.volume must be within 0..1, so clamp the sum
            volSum = volumeSelect.reduce((a, b) => a + b, 0);
            audio.volume = Math.min(1, volSum / 100);
            button.textContent = `volume: ${volSum}`;
        });

        volumeOptions.push(newElement);
        document.body.appendChild(newElement);
        bounce(newElement);
    }
});

document.body.appendChild(button);

// animation 
function bounce(el, speed = Math.random() * 200 + 300, friction = 0.8) {
    // Take the element out of the flow so it can move freely.
    Object.assign(el.style, {
        position: "fixed",
        top: "0",
        left: "0",
        margin: "0",
        whiteSpace: "nowrap",
    });

    // random direction over the full circle, speed 50-100% of `speed` (px per second)
    const angle = Math.random() * Math.PI * 2;
    const s = speed * (0.5 + Math.random() * 0.5);

    // offsetLeft/Top ignore the button's translate(-50%, -50%), so use the real rect
    const rect = button.getBoundingClientRect();
    const state = {
        x: rect.left + rect.width / 2 - el.offsetWidth / 2,
        y: rect.top + rect.height / 2 - el.offsetHeight / 2,
        vx: Math.cos(angle) * s,
        vy: Math.sin(angle) * s,
    };

    let last = performance.now();

    function frame(now) {
        const dt = (now - last) / 1000; // seconds since last frame
        last = now;

        const maxX = window.innerWidth - el.offsetWidth;
        const maxY = window.innerHeight - el.offsetHeight;

        // slow the velocity itself (frame-rate independent), then move by it
        const damp = Math.pow(friction, dt);
        state.vx *= damp;
        state.vy *= damp;
        state.x += state.vx * dt;
        state.y += state.vy * dt;

        // Reverse direction when a border is hit.
        if (state.x <= 0)    { state.x = 0;    state.vx =  Math.abs(state.vx); }
        if (state.x >= maxX) { state.x = maxX; state.vx = -Math.abs(state.vx); }
        if (state.y <= 0)    { state.y = 0;    state.vy =  Math.abs(state.vy); }
        if (state.y >= maxY) { state.y = maxY; state.vy = -Math.abs(state.vy); }

        el.style.transform = `translate(${state.x}px, ${state.y}px)`;

        // Stop the loop once it's basically at rest
        if (Math.hypot(state.vx, state.vy) > 1) {
            requestAnimationFrame(frame);
        }
        else {
            el.style.transition = "opacity 0.8s";
            el.style.opacity = "0";
            setTimeout(() => el.remove(), 500);
            volumeOptions = volumeOptions.filter((e) => e !== el);
        }
    }

    requestAnimationFrame(frame);
}
