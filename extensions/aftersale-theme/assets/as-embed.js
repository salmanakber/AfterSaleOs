/* Kept for compatibility; embeds no longer use mock chrome. */
(function () {
  function init() {
    /* no-op: live iframes only */
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
