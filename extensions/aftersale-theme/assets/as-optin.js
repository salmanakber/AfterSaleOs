(function () {
  function syncPanel(root) {
    var check = root.querySelector("[data-as-optin-check]");
    var panel = root.querySelector("[data-as-optin-panel]");
    if (!check) return;
    if (panel) panel.hidden = !check.checked;
    root.classList.toggle("is-checked", check.checked);
    try {
      if (check.checked) {
        sessionStorage.setItem("aftersale_register_intent", "1");
        var url = root.getAttribute("data-register-url");
        if (url) sessionStorage.setItem("aftersale_register_url", url);
      } else {
        sessionStorage.removeItem("aftersale_register_intent");
        sessionStorage.removeItem("aftersale_register_url");
      }
    } catch (e) {
      /* ignore */
    }
    setCartAttribute("aftersale_register_intent", check.checked ? "yes" : "");
  }

  function setCartAttribute(key, value) {
    if (!window.fetch) return;
    var attrs = {};
    attrs[key] = value || null;
    fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ attributes: attrs }),
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
    // Ensure clicks on the custom box toggle the input
    check.addEventListener("change", function () {
      syncPanel(root);
    });
    check.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    syncPanel(root);
  }

  function findProductMount() {
    var form =
      document.querySelector("form[action*='/cart/add']") ||
      document.querySelector("product-form form") ||
      document.querySelector("product-form") ||
      document.querySelector("[data-product-form]") ||
      document.querySelector(".product-form");

    if (form) {
      var submit =
        form.querySelector("button[type='submit']") ||
        form.querySelector("button[name='add']") ||
        form.querySelector("input[type='submit']") ||
        form.querySelector("[name='add']") ||
        form.querySelector(".product-form__submit") ||
        form.querySelector("[data-add-to-cart]");
      if (submit && submit.parentNode) {
        return { parent: submit.parentNode, before: submit };
      }
      return { parent: form, before: null, append: true };
    }

    var info =
      document.querySelector(".product__info-container") ||
      document.querySelector(".product-single__meta") ||
      document.querySelector("[data-product-information]");
    if (info) return { parent: info, before: null, append: true };
    return null;
  }

  function findCartMount() {
    var checkout =
      document.querySelector("button[name='checkout']") ||
      document.querySelector("input[name='checkout']") ||
      document.querySelector("[name='checkout']") ||
      document.querySelector("button[form='cart']") ||
      document.querySelector(".cart__checkout-button") ||
      document.querySelector("[data-cart-checkout]");

    if (checkout && checkout.parentNode) {
      return { parent: checkout.parentNode, before: checkout };
    }

    var cartForm =
      document.querySelector("form[action='/cart']") ||
      document.querySelector("form[action$='/cart']") ||
      document.querySelector("form[action*='/cart']") ||
      document.querySelector("cart-items") ||
      document.querySelector(".cart__contents");
    if (cartForm) return { parent: cartForm, before: null, append: true };
    return null;
  }

  function place(embed, spot) {
    if (!spot) {
      var main = document.querySelector("main") || document.body;
      main.appendChild(embed);
      return;
    }
    if (spot.before && spot.before.parentNode === spot.parent) {
      spot.parent.insertBefore(embed, spot.before);
    } else if (spot.append) {
      spot.parent.appendChild(embed);
    } else {
      spot.parent.insertAdjacentElement("afterend", embed);
    }
  }

  function mountEmbed() {
    var embed = document.querySelector("[data-as-embed-mount]");
    if (!embed || embed.dataset.asMounted === "1") return;
    embed.dataset.asMounted = "1";

    var mode = embed.getAttribute("data-as-mount") || "product";
    var spot = mode === "cart" ? findCartMount() : findProductMount();
    place(embed, spot);
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

  document.addEventListener("shopify:section:load", function () {
    document.querySelectorAll("[data-as-optin]").forEach(function (el) {
      el.dataset.asBound = "";
    });
    var embed = document.querySelector("[data-as-embed-mount]");
    if (embed) embed.dataset.asMounted = "";
    init();
  });
})();
