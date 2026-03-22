// Theme toggle — switches CSS variables + screenshot
const themeToggle = document.querySelector(".theme-toggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const isLight = document.documentElement.dataset.theme === "light";
    const newTheme = isLight ? "dark" : "light";
    document.documentElement.dataset.theme = isLight ? "" : "light";
    if (isLight) {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }

    // Switch screenshot
    document.querySelectorAll(".screenshot-img").forEach((img) => {
      img.classList.toggle("active", img.dataset.theme === newTheme);
    });
  });
}

// Scroll fade-in animation
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.1 }
);

document.querySelectorAll(".fade-in").forEach((el) => observer.observe(el));

// Mobile hamburger menu
const hamburger = document.querySelector(".hamburger");
const nav = document.querySelector(".nav");

if (hamburger && nav) {
  hamburger.addEventListener("click", () => {
    nav.classList.toggle("open");
    hamburger.setAttribute(
      "aria-expanded",
      nav.classList.contains("open").toString()
    );
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });
}
