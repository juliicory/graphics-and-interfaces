// Burger menu: lets the page switch between each week's script.
// Scripts are reloaded (not hot-swapped) because they declare top-level
// consts (canvas, gl, mouse, ...) that would clash if injected twice.
(function () {
    const WEEKS = [
        { label: "Week 1", file: "week-1.js" },
        { label: "Week 2", file: "week-2.js" },
    ];
    const STORAGE_KEY = "selectedWeek";
    const DEFAULT_WEEK = WEEKS[WEEKS.length - 1].file;

    const currentWeek = localStorage.getItem(STORAGE_KEY) || DEFAULT_WEEK;

    const toggle = document.getElementById("menu-toggle");
    const list = document.getElementById("week-list");

    function openMenu() {
        list.hidden = false;
        toggle.setAttribute("aria-expanded", "true");
    }

    function closeMenu() {
        list.hidden = true;
        toggle.setAttribute("aria-expanded", "false");
    }

    WEEKS.forEach((week) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "week-option";
        btn.textContent = week.label;
        if (week.file === currentWeek) btn.classList.add("active");

        btn.addEventListener("click", () => {
            if (week.file === currentWeek) {
                closeMenu();
                return;
            }
            localStorage.setItem(STORAGE_KEY, week.file);
            location.reload();
        });

        li.appendChild(btn);
        list.appendChild(li);
    });

    toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        if (list.hidden) openMenu();
        else closeMenu();
    });

    document.addEventListener("click", (e) => {
        if (!list.hidden && e.target !== toggle && !list.contains(e.target)) {
            closeMenu();
        }
    });

    // Load the currently selected week's script.
    const script = document.createElement("script");
    script.src = currentWeek;
    document.body.appendChild(script);
})();
