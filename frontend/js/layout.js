/**
 * Campus Placement AI — shared app shell (sidebar + top header) injected into
 * every page. The active nav item is derived from <body data-page="...">.
 * On small screens the sidebar becomes a slide-in drawer toggled from the
 * hamburger button in the top header.
 */
(function () {
  const NAV_ITEMS = [
    { path: "landing", href: "index.html", label: "Home", icon: "home" },
    { path: "dashboard-overview", href: "dashboard.html", label: "Dashboard", icon: "dashboard" },
    { path: "agent-chat-rag", href: "chat.html", label: "Ask AI", icon: "chat" },
    { path: "candidate-profile-parsing", href: "profile.html", label: "My Profile", icon: "person" },
    { path: "live-job-matching", href: "jobs.html", label: "Find Jobs", icon: "work" },
    { path: "email-gatekeeper-dispatch", href: "email.html", label: "Email Dispatch", icon: "mail" },
  ];

  const ACTIVE_CLASS = "flex items-center gap-space-md px-gutter py-space-md font-label-md text-label-md text-primary-fixed bg-slate-elevated font-semibold border-l-2 border-primary-container";
  const INACTIVE_CLASS = "flex items-center gap-space-md px-gutter py-space-md font-body-md text-body-md text-on-surface-variant hover:bg-slate-elevated/60 hover:text-chalk-text transition-colors";

  function currentPath() {
    return (document.body && document.body.dataset.page) || "";
  }

  function currentLabel() {
    const active = currentPath();
    for (var i = 0; i < NAV_ITEMS.length; i++) {
      if (NAV_ITEMS[i].path === active) return NAV_ITEMS[i].label;
    }
    return "";
  }

  function navHtml() {
    const active = currentPath();
    return NAV_ITEMS.map(function (item) {
      const cls = item.path === active ? ACTIVE_CLASS : INACTIVE_CLASS;
      return '<a class="' + cls + '" data-path="' + item.path + '" href="' + item.href + '">'
        + '<span class="material-symbols-outlined text-[18px] shrink-0">' + item.icon + '</span>'
        + "<span>" + item.label + "</span></a>";
    }).join("");
  }

  function sidebarHtml() {
    return [
      '<div class="flex flex-col h-full">',
      '  <div class="h-16 px-gutter flex items-center justify-between border-b border-slate-border">',
      '    <a href="index.html" class="flex items-center gap-space-sm min-w-0 group">',
      '      <div class="flex flex-col justify-center gap-[3px] w-5 h-4 shrink-0">',
      '        <span class="h-[2px] w-5 bg-gradient-to-r from-brand-hotpink via-pink-400 to-white rounded-full transition-all duration-300 group-hover:w-6"></span>',
      '        <span class="h-[2px] w-3.5 bg-white rounded-full transition-all duration-300 group-hover:w-5"></span>',
      '        <span class="h-[2px] w-4 bg-brand-fuchsia rounded-full transition-all duration-300 group-hover:w-3"></span>',
      '      </div>',
      '      <div class="flex flex-col min-w-0">',
      '        <span class="font-headline-sm text-headline-sm text-chalk-text truncate flex items-center gap-1.5">SYS_0 <span class="text-[9px] tracking-widest uppercase px-1.5 py-0.5 rounded border border-primary-container/40 bg-primary-container/10 text-pink-300 font-mono font-medium">PLACEMENT</span></span>',
      '        <span class="font-body-sm text-body-sm text-titanium-muted truncate">Multi-agent infra</span>',
      "      </div>",
      "    </a>",
      '    <button class="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-slate-elevated hover:bg-slate-border text-chalk-text transition-colors" id="shell-menu-close-btn" aria-label="Close menu">',
      '      <span class="material-symbols-outlined text-[20px]">close</span>',
      "    </button>",
      "  </div>",
      '  <nav class="flex flex-col py-space-sm px-space-sm gap-0.5 flex-1 overflow-y-auto" aria-label="Primary">',
      navHtml(),
      "  </nav>",
      '  <div class="p-gutter border-t border-slate-border">',
      '    <div class="bg-slate-elevated rounded-lg p-space-md flex items-center gap-space-md">',
      '      <span class="w-2 h-2 rounded-full bg-primary-container sf-pulse-ring shrink-0" id="shell-status-dot"></span>',
      '      <div class="flex flex-col min-w-0">',
      '        <span class="font-label-sm text-label-sm text-chalk-text uppercase" id="shell-status-text">Checking backend…</span>',
      '        <span class="font-body-sm text-body-sm text-titanium-muted">System status · v1.0</span>',
      "      </div>",
      "    </div>",
      "  </div>",
      "</div>",
    ].join("\n");
  }

  function headerHtml() {
    return [
      '<header class="fixed top-0 left-0 right-0 lg:left-64 h-16 bg-black/70 backdrop-blur-md border-b border-slate-border z-40 flex items-center justify-between px-gutter-lg">',
      '  <div class="flex items-center gap-space-md">',
      '    <button class="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-slate-elevated hover:bg-slate-border text-chalk-text transition-colors shrink-0" id="shell-menu-btn" aria-label="Open menu">',
      '      <span class="material-symbols-outlined text-[22px]">menu</span>',
      "    </button>",
      '    <span class="font-headline-sm text-headline-sm text-chalk-text">' + currentLabel() + "</span>",
      "  </div>",
      '  <div class="flex items-center gap-space-md">',
      '    <div class="hidden sm:flex items-center gap-space-xs px-space-md py-1 rounded-full bg-slate-elevated">',
      '      <span class="w-2 h-2 rounded-full bg-primary-container sf-pulse-ring" id="shell-header-status-dot"></span>',
      '      <span class="font-body-sm text-body-sm text-on-surface-variant" id="shell-header-status-text">Systems operational</span>',
      "    </div>",
      '    <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center">',
      '      <span class="material-symbols-outlined text-on-primary text-[16px]">person</span>',
      "    </div>",
      "  </div>",
      "</header>",
    ].join("\n");
  }

  // --- Shared motion layer: entrance / reveal animations + micro-interactions ---
  const ANIM_CSS = [
    "@keyframes sf-fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}",
    "@keyframes sf-fade-in{from{opacity:0}to{opacity:1}}",
    "@keyframes sf-pop{0%{opacity:0;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}",
    "@keyframes sf-swoop{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}",
    "@keyframes sf-pulse-ring{0%{box-shadow:0 0 0 0 rgba(244,37,136,.4)}70%{box-shadow:0 0 0 7px rgba(244,37,136,0)}100%{box-shadow:0 0 0 0 rgba(244,37,136,0)}}",
    "@keyframes sf-blink{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}",
    "@keyframes sf-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}",
    ".reveal{opacity:0;transform:translateY(16px);transition:opacity .55s cubic-bezier(.22,1,.36,1),transform .55s cubic-bezier(.22,1,.36,1);transition-delay:var(--d,0ms);will-change:opacity,transform}",
    ".reveal.in-view{opacity:1;transform:none}",
    ".anim-in{opacity:0;animation:sf-fade-up .5s cubic-bezier(.22,1,.36,1) var(--d,0ms) forwards}",
    ".sf-fade-in{animation:sf-fade-in .45s ease var(--d,0ms) both}",
    ".sf-swoop{animation:sf-swoop .4s cubic-bezier(.22,1,.36,1) var(--d,0ms) both}",
    ".sf-pop-in{animation:sf-pop .28s cubic-bezier(.22,1,.36,1) var(--d,0ms) both}",
    ".sf-float{animation:sf-float 4s ease-in-out infinite}",
    ".sf-pulse-ring{animation:sf-pulse-ring 2s ease-out infinite}",
    "button:not(:disabled),input[type=range],[role=button]{transition:transform .12s ease,box-shadow .2s ease,background-color .2s ease,border-color .2s ease,color .2s ease,opacity .2s ease}",
    "button:not(:disabled):active,input[type=range]:active{transform:scale(.96)}",
    ".card-lift{transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease}",
    ".card-lift:hover{transform:translateY(-3px);box-shadow:0 14px 28px -14px rgba(15,23,42,.22);border-color:#c7d2fe}",
    ".card-lift:active{transform:translateY(-1px) scale(.995)}",
    ".sf-progress{transition:width .6s cubic-bezier(.22,1,.36,1)}",
    ".sf-typing{display:inline-flex;gap:4px;align-items:center}",
    ".sf-typing span{width:6px;height:6px;border-radius:9999px;background:currentColor;animation:sf-blink 1.2s infinite}",
    ".sf-typing span:nth-child(2){animation-delay:.18s}",
    ".sf-typing span:nth-child(3){animation-delay:.36s}",
    "@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}",
  ].join("\n");

  function installAnimations() {
    if (document.getElementById("shell-anim")) return;
    const style = document.createElement("style");
    style.id = "shell-anim";
    style.textContent = ANIM_CSS + [
      "",
      "html{background:#030206;scrollbar-color:#2d1b37 #0a0413;scrollbar-width:thin;}",
      "body{background:#030206;color:#fff;min-height:100%;overflow-y:auto;}",
      "input,textarea,select{color-scheme:dark;}",
      "input::placeholder,textarea::placeholder{color:#9b8aa3;}",
      "::-webkit-scrollbar{width:8px;height:8px;}",
      "::-webkit-scrollbar-track{background:#0a0413;}",
      "::-webkit-scrollbar-thumb{background:#2d1b37;border-radius:8px;}",
      "::-webkit-scrollbar-thumb:hover{background:#f42588;}",
      "::selection{background:#f42588;color:#030206;}",
      "button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{outline:2px solid #ff3b99;outline-offset:2px;}",
    ].join("\n");
    document.head.appendChild(style);

    const supportsIO = typeof IntersectionObserver !== "undefined";
    const io = supportsIO ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in-view"); io.unobserve(en.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }) : null;

    function track(el, i) {
      if (!el || el.nodeType !== 1 || !el.classList) return;
      if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", Math.min((i || 0) * 70, 480) + "ms");
      if (io) io.observe(el); else el.classList.add("in-view");
    }

    function stagger(container) {
      if (!container) return;
      Array.prototype.forEach.call(container.children, function (el, i) {
        if (io) io.unobserve(el);
        el.classList.remove("reveal", "in-view");
        el.classList.add("anim-in");
        el.style.setProperty("--d", Math.min(i * 60, 420) + "ms");
      });
    }

    const main = document.querySelector("main");
    if (main) {
      Array.prototype.forEach.call(main.children, function (el, i) { el.classList.add("reveal"); track(el, i); });
    }
    Array.prototype.forEach.call(document.querySelectorAll(".reveal"), track);

    if (typeof MutationObserver !== "undefined") {
      const mo = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType !== 1 || !n.classList) return;
            if (n.classList.contains("reveal")) track(n);
            if (n.classList.contains("anim-in") && !n.style.getPropertyValue("--d")) n.style.setProperty("--d", "0ms");
          });
        });
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }

    window.CPMotion = { stagger: stagger };
  }

  let open = false;

  function setDrawer(openState) {
    open = openState;
    const aside = document.getElementById("shell-sidebar");
    const overlay = document.getElementById("shell-overlay");
    if (aside) aside.classList.toggle("translate-x-0", openState);
    if (aside) aside.classList.toggle("-translate-x-full", !openState);
    if (overlay) overlay.classList.toggle("hidden", !openState);
  }

  function wireDrawer() {
    const menuBtn = document.getElementById("shell-menu-btn");
    const closeBtn = document.getElementById("shell-menu-close-btn");
    const overlay = document.getElementById("shell-overlay");
    const sidebar = document.getElementById("shell-sidebar");

    if (menuBtn) menuBtn.addEventListener("click", function () { setDrawer(true); });
    if (closeBtn) closeBtn.addEventListener("click", function () { setDrawer(false); });
    if (overlay) overlay.addEventListener("click", function () { setDrawer(false); });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) setDrawer(false);
    });

    if (sidebar) {
      sidebar.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () { setDrawer(false); });
      });
    }
  }

  function inject() {
    installAnimations();
    const aside = document.getElementById("shell-sidebar");
    const header = document.getElementById("shell-header");
    if (aside) {
      aside.className = "fixed left-0 top-0 h-full w-64 max-w-[80vw] bg-surface z-50 flex flex-col justify-between border-r border-slate-border -translate-x-full lg:translate-x-0 transition-transform duration-200 lg:transition-none overflow-hidden";
      aside.setAttribute("aria-label", "Primary navigation");
      aside.innerHTML = sidebarHtml();
    }
    if (header) header.innerHTML = headerHtml();

    if (!document.getElementById("shell-overlay")) {
      const overlay = document.createElement("div");
      overlay.id = "shell-overlay";
      overlay.className = "fixed inset-0 z-30 bg-slate-border/40 backdrop-blur-sm hidden lg:hidden";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }

    wireDrawer();

    // Mirror real backend status into the shell when the API client exists.
    if (aside && window.CampusPlacementAPI) {
      const statusText = document.getElementById("shell-status-text");
      const statusDot = document.getElementById("shell-status-dot");
      const headerText = document.getElementById("shell-header-status-text");
      const headerDot = document.getElementById("shell-header-status-dot");

      window.CampusPlacementAPI.getSystemStatus()
        .then(function () {
          if (statusText) statusText.textContent = "Backend online";
          if (headerText) headerText.textContent = "All systems operational";
        })
        .catch(function () {
          if (statusText) statusText.textContent = "Backend unreachable";
          if (statusDot) statusDot.classList.remove("bg-primary-container");
          if (statusDot) statusDot.classList.add("bg-error");
          if (headerText) headerText.textContent = "Backend unreachable";
          if (headerDot) headerDot.classList.remove("bg-primary-container");
          if (headerDot) headerDot.classList.add("bg-error");
        });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();