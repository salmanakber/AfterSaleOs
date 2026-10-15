(function () {
  var ATTR_KEY = "aftersale_register_intent";
  var PROP_KEY = "_aftersale_register";

  function moneyLabel(cents, currency) {
    if (cents == null || !Number.isFinite(Number(cents))) return "";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
      }).format(Number(cents) / 100);
    } catch (e) {
      return "$" + (Number(cents) / 100).toFixed(2);
    }
  }

  function syncPanel(root) {
    var check = root.querySelector("[data-as-optin-check]");
    var panel = root.querySelector("[data-as-optin-panel]");
    var status = root.querySelector("[data-as-optin-status]");
    if (!check) return;
    if (panel) panel.hidden = !check.checked;
    root.classList.toggle("is-checked", check.checked);
    if (status) {
      status.textContent = check.checked
        ? root.getAttribute("data-checked-status") ||
          "Warranty will be registered automatically when you complete checkout."
        : "";
      status.hidden = !check.checked;
    }
    try {
      if (check.checked) sessionStorage.setItem(ATTR_KEY, "1");
      else {
        sessionStorage.removeItem(ATTR_KEY);
        sessionStorage.removeItem("aftersale_register_url");
      }
    } catch (e) {
      /* ignore */
    }
    injectFormAttributes(check.checked);
    injectLineProperties(check.checked);
    setCartAttribute(ATTR_KEY, check.checked ? "yes" : "").then(function () {
      root.classList.toggle("is-saved", check.checked);
    });
    syncWarrantyFee(root, check.checked);
  }

  function setCartAttribute(key, value) {
    if (!window.fetch) return Promise.resolve();
    var attrs = {};
    attrs[key] = value || null;
    return fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ attributes: attrs }),
      credentials: "same-origin",
    }).catch(function () {});
  }

  function injectFormAttributes(checked) {
    var forms = document.querySelectorAll(
      "form[action*='/cart'], form[action='/cart'], form[action$='/cart'], form[action*='/cart/add']",
    );
    forms.forEach(function (form) {
      var existing = form.querySelector('input[name="attributes[' + ATTR_KEY + ']"]');
      if (!checked) {
        if (existing) existing.remove();
        return;
      }
      if (!existing) {
        existing = document.createElement("input");
        existing.type = "hidden";
        existing.name = "attributes[" + ATTR_KEY + "]";
        form.appendChild(existing);
      }
      existing.value = "yes";
    });
  }

  /** Line-item property survives checkout more reliably than cart attributes alone. */
  function injectLineProperties(checked) {
    var forms = document.querySelectorAll("form[action*='/cart/add']");
    forms.forEach(function (form) {
      var existing = form.querySelector('input[name="properties[' + PROP_KEY + ']"]');
      if (!checked) {
        if (existing) existing.remove();
        return;
      }
      if (!existing) {
        existing = document.createElement("input");
        existing.type = "hidden";
        existing.name = "properties[" + PROP_KEY + "]";
        form.appendChild(existing);
      }
      existing.value = "yes";
    });
  }

  function getFeeVariantId(root) {
    return (root.getAttribute("data-fee-variant-id") || "").replace(/\D/g, "");
  }

  function syncWarrantyFee(root, enabled) {
    var variantId = getFeeVariantId(root);
    if (!variantId || !window.fetch) return;
    if (!enabled) {
      removeFeeLines(variantId);
      return;
    }
    fetch("/cart.js", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json();
      })
      .then(function (cart) {
        var items = (cart && cart.items) || [];
        var already = items.some(function (it) {
          return (
            String(it.variant_id) === variantId ||
            (it.properties && it.properties._aftersale_warranty_fee === "1")
          );
        });
        if (already) return;
        return fetch("/cart/add.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            items: [
              {
                id: Number(variantId),
                quantity: 1,
                properties: { _aftersale_warranty_fee: "1" },
              },
            ],
          }),
        });
      })
      .catch(function () {});
  }

  function removeFeeLines(variantId) {
    fetch("/cart.js", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json();
      })
      .then(function (cart) {
        var updates = {};
        var changed = false;
        ((cart && cart.items) || []).forEach(function (it) {
          var isFee =
            String(it.variant_id) === variantId ||
            (it.properties && it.properties._aftersale_warranty_fee === "1");
          if (isFee) {
            updates[it.key] = 0;
            changed = true;
          }
        });
        if (!changed) return;
        return fetch("/cart/update.js", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ updates: updates }),
        });
      })
      .catch(function () {});
  }

  function applyFeeConfig(root, cfg) {
    if (!cfg || !cfg.warrantyFeeEnabled || !cfg.warrantyFeeVariantId) {
      root.removeAttribute("data-fee-variant-id");
      var feeNote = root.querySelector("[data-as-fee-note]");
      if (feeNote) feeNote.hidden = true;
      return;
    }
    root.setAttribute("data-fee-variant-id", String(cfg.warrantyFeeVariantId));
    var note = root.querySelector("[data-as-fee-note]");
    if (note) {
      var label = cfg.warrantyFeeLabel || "Warranty registration";
      var price = moneyLabel(cfg.warrantyFeeCents, cfg.currency);
      note.textContent = price
        ? label + " · " + price + " added at checkout when checked"
        : label + " fee applies when checked";
      note.hidden = false;
    }
  }

  function loadFeeConfig(root) {
    var shop = root.getAttribute("data-shop") || "";
    var api = root.getAttribute("data-fee-api") || "";
    if (!shop || !api || !window.fetch) return;
    fetch(api + (api.indexOf("?") >= 0 ? "&" : "?") + "shop=" + encodeURIComponent(shop), {
      headers: { Accept: "application/json" },
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (json) {
        if (json) applyFeeConfig(root, json);
      })
      .catch(function () {});
  }

  function bind(root) {
    if (!root || root.dataset.asBound === "1") return;
    root.dataset.asBound = "1";
    var check = root.querySelector("[data-as-optin-check]");
    loadFeeConfig(root);
    if (!check) return;
    check.addEventListener("change", function () {
      syncPanel(root);
    });
    check.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    var card = root.querySelector("[data-as-optin-card]");
    if (card) {
      card.addEventListener("click", function (e) {
        if (e.target === check || (e.target && e.target.closest && e.target.closest("a,label"))) return;
        e.preventDefault();
        check.checked = !check.checked;
        syncPanel(root);
      });
    }
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

  function reassertIntentBeforeCheckout(e) {
    var target = e.target;
    if (!target || !target.closest) return;
    var checkout =
      target.closest("[name='checkout']") ||
      target.closest("button[name='checkout']") ||
      target.closest(".cart__checkout-button") ||
      target.closest("[data-cart-checkout]");
    if (!checkout) return;
    var checked = document.querySelector("[data-as-optin-check]:checked");
    if (!checked) return;
    injectFormAttributes(true);
    injectLineProperties(true);
    setCartAttribute(ATTR_KEY, "yes");
  }

  function init() {
    document.querySelectorAll("[data-as-optin]").forEach(bind);
    mountEmbed();
    if (!document.documentElement.dataset.asOptinCheckoutGuard) {
      document.documentElement.dataset.asOptinCheckoutGuard = "1";
      document.addEventListener("click", reassertIntentBeforeCheckout, true);
    }
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
