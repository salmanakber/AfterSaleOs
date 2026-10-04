(function () {
  function syncPanel(root) {
    var check = root.querySelector("[data-as-optin-check]");
    var panel = root.querySelector("[data-as-optin-panel]");
    if (!check || !panel) return;
    panel.hidden = !check.checked;
    root.classList.toggle("is-checked", check.checked);
    try {
      if (check.checked) {
        sessionStorage.setItem("aftersale_register_intent", "1");
        var url = root.getAttribute("data-register-url");
        if (url) sessionStorage.setItem("aftersale_register_url", url);
      } else {
        sessionStorage.removeItem("aftersale_register_intent");
      }
    } catch (e) {
      /* ignore */
    }
    if (check.checked) {
      setCartAttribute("aftersale_register_intent", "yes");
    }
  }

  function setCartAttribute(key, value) {
    if (!window.fetch) return;
    fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ attributes: { [key]: value } }),
    }).catch(function () {
      /* cart API optional */
    });
  }

  function bind(root) {
    if (!root || root.dataset.asBound === "1") return;
    root.dataset.asBound = "1";
    var check = root.querySelector("[data-as-optin-check]");
    var btn = root.querySelector("[data-as-optin-btn]");
    if (btn) {
      btn.addEventListener("click", function () {
        try {
          sessionStorage.setItem("aftersale_register_intent", "1");
          var url = root.getAttribute("data-register-url");
          if (url) sessionStorage.setItem("aftersale_register_url", url);
        } catch (e) {
          /* ignore */
        }
        setCartAttribute("aftersale_register_intent", "yes");
      });
    }
    if (!check) return;
    check.addEventListener("change", function () {
      syncPanel(root);
    });
    syncPanel(root);
  }

  function mountEmbed() {
    var embed = document.querySelector("[data-as-embed-mount]");
    if (!embed) return;
    var selectors = [
      "form[action*='/cart/add']",
      "product-form",
      ".product-form",
      "[data-product-form]",
      ".product__info-container",
      ".product-single__meta",
    ];
    var host = null;
    for (var i = 0; i < selectors.length; i++) {
      host = document.querySelector(selectors[i]);
      if (host) break;
    }
    if (host) {
      host.insertAdjacentElement("afterend", embed);
    } else {
      var main = document.querySelector("main") || document.body;
      main.appendChild(embed);
    }
    embed.style.display = "";
    bind(embed);
  }

  function init() {
    document.querySelectorAll("[data-as-optin]").forEach(bind);
    mountEmbed();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
