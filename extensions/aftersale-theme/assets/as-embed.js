(function () {
  function isDesignMode() {
    try {
      return Boolean(window.Shopify && window.Shopify.designMode);
    } catch (e) {
      return false;
    }
  }

  function setup(root) {
    if (!root || root.dataset.asEmbedReady === "1") return;
    root.dataset.asEmbedReady = "1";
    var frame = root.querySelector("[data-as-embed-frame]");
    var mock = root.querySelector("[data-as-embed-mock]");
    if (!frame) return;

    // Theme editor often blocks third-party iframes — keep the mock preview visible.
    if (isDesignMode()) {
      root.classList.add("is-design-mode");
      if (mock) mock.hidden = false;
      return;
    }

    var loaded = false;
    var markLoaded = function () {
      if (loaded) return;
      loaded = true;
      root.classList.add("is-frame-loaded");
      if (mock) mock.hidden = true;
    };

    frame.addEventListener("load", function () {
      // Cross-origin: load fires even for error pages sometimes; hide mock on live storefront.
      markLoaded();
    });

    // If the frame is blocked, keep mock + open link available.
    window.setTimeout(function () {
      if (!loaded && mock) {
        root.classList.add("is-frame-blocked");
        mock.hidden = false;
      }
    }, 2500);
  }

  function init() {
    document.querySelectorAll("[data-as-embed]").forEach(setup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  document.addEventListener("shopify:section:load", init);
  document.addEventListener("shopify:block:select", init);
})();
