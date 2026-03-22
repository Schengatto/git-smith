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

  // Close menu on nav link click
  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });
}

// Screenshot dark/light toggle
document.querySelectorAll(".toggle-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const theme = btn.dataset.theme;
    document.querySelectorAll(".toggle-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".screenshot-img").forEach((img) => img.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`.screenshot-img[data-theme="${theme}"]`)?.classList.add("active");
  });
});

// Smooth active header on scroll
const header = document.querySelector(".header");
if (header) {
  window.addEventListener("scroll", () => {
    header.classList.toggle("scrolled", window.scrollY > 10);
  });
}
