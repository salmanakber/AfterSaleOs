/* Theme-block iframes: grow to fit portal content; never navigate the storefront away. */
(function () {
  function resizeFrame(frame, height) {
    if (!frame || !height) return;
    var min = parseInt(frame.getAttribute("data-as-min-height") || "480", 10) || 480;
    var next = Math.max(min, Math.ceil(Number(height)));
    if (Math.abs((parseInt(frame.style.height, 10) || 0) - next) < 4) return;
    frame.style.height = next + "px";
  }

  function onMessage(event) {
    var data = event && event.data;
    if (!data || data.type !== "aftersale-embed-height") return;
    var frames = document.querySelectorAll("iframe.as-embed-block__frame");
    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];
      if (frame.contentWindow === event.source) {
        resizeFrame(frame, data.height);
      }
    }
  }

  function init() {
    window.addEventListener("message", onMessage);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
