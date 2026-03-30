// ==UserScript==
// @name         Proxmox VE: Dismiss "No Valid Subscription"
// @namespace    https://proxmox.com/
// @version      1.1.0
// @description  Automatically dismiss the Proxmox VE "No valid subscription" notice.
// @author       Codex
// @match        https://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  if (location.port !== "8006") {
    return;
  }

  const NOTICE_PATTERNS = [
    /no valid subscription/i,
    /you do not have a valid subscription for this server/i,
  ];

  function normalizeText(value) {
    return String(value ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isSubscriptionNotice(text) {
    const normalized = normalizeText(text);
    return NOTICE_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  function clickDismissButton(root) {
    const buttons = root.querySelectorAll("a, button, span, div");
    for (const button of buttons) {
      if (/^\s*ok\s*$/i.test(button.textContent || "")) {
        button.click();
        return true;
      }
    }
    return false;
  }

  function dismissDomNotice() {
    const candidates = document.querySelectorAll(".x-window, [role='dialog']");
    for (const node of candidates) {
      const text = normalizeText(node.textContent || "");
      if (!isSubscriptionNotice(text)) {
        continue;
      }

      if (clickDismissButton(node)) {
        return true;
      }

      const closeButton = node.querySelector(".x-tool-close");
      if (closeButton instanceof HTMLElement) {
        closeButton.click();
        return true;
      }
    }
    return false;
  }

  function installExtHook() {
    const ext = window.Ext;
    if (!ext || !ext.Msg || ext.Msg.__subscriptionNagHooked) {
      return;
    }

    const originalShow = ext.Msg.show.bind(ext.Msg);
    ext.Msg.show = function patchedShow(config) {
      const title = normalizeText(config?.title);
      const message = normalizeText(config?.message || config?.msg);

      if (isSubscriptionNotice(`${title} ${message}`)) {
        const callback = config?.callback;
        if (typeof callback === "function") {
          window.setTimeout(() => callback("ok"), 0);
        }
        return null;
      }

      return originalShow(config);
    };

    ext.Msg.__subscriptionNagHooked = true;
  }

  const bootstrapTimer = window.setInterval(() => {
    installExtHook();
    dismissDomNotice();
  }, 250);

  window.setTimeout(() => {
    window.clearInterval(bootstrapTimer);
  }, 15000);

  new MutationObserver(() => {
    dismissDomNotice();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
