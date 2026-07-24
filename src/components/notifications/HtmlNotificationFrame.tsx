import { useEffect, useRef } from "react";

import type { Notification } from "@/lib/tauri";

interface HtmlNotificationFrameProps {
  notification: Notification;
  className?: string;
  onFrameClick?: () => void;
  onLinkClick?: (url: string) => void;
}

export function isHtmlNotification(notification: Notification) {
  return notification.content_type === "html" || Boolean(notification.html_content);
}

function rewriteDocumentSelectors(css: string) {
  return css.replace(
    /(^|[,{]\s*)(html|body)(?=\s*(?:$|[,>{+~.#:[*]))/gi,
    "$1#espander-notification-root"
  );
}

function extractBodyHtml(html: string) {
  const documentValue = new DOMParser().parseFromString(html, "text/html");
  documentValue
    .querySelectorAll("script, base, object, embed, meta[http-equiv]")
    .forEach((node) => node.remove());
  documentValue.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
      if (
        (attribute.name === "href" || attribute.name === "src") &&
        /^\s*(?:javascript|data\s*:\s*text\/html)/i.test(attribute.value)
      ) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  documentValue.querySelectorAll("iframe").forEach((iframe) => {
    iframe.removeAttribute("srcdoc");
    iframe.setAttribute("sandbox", "");
  });
  return documentValue.body.innerHTML;
}

export function HtmlNotificationFrame({
  notification,
  className,
  onFrameClick,
  onLinkClick,
}: HtmlNotificationFrameProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.replaceChildren();
    const html = extractBodyHtml(notification.html_content ?? "");
    const customCss = rewriteDocumentSelectors(notification.custom_css ?? "");

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        width: 100%;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      #espander-notification-root {
        display: flow-root;
        width: 100%;
        overflow: visible;
        color: inherit;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      img, svg, video, canvas {
        max-width: 100%;
      }
      a {
        cursor: pointer;
      }
      ${customCss}
    `;

    const root = document.createElement("div");
    root.id = "espander-notification-root";
    root.innerHTML = html;

    root.querySelectorAll("style").forEach((inlineStyle) => {
      inlineStyle.textContent = rewriteDocumentSelectors(inlineStyle.textContent ?? "");
    });

    shadow.append(style, root);

    const preventContextMenu = (event: Event) => {
      event.preventDefault();
    };

    const handleClick = (event: Event) => {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a") : null;

      if (anchor instanceof HTMLAnchorElement && anchor.href) {
        event.preventDefault();
        event.stopPropagation();
        onLinkClick?.(anchor.href);
        return;
      }

      onFrameClick?.();
    };

    shadow.addEventListener("contextmenu", preventContextMenu, { capture: true });
    shadow.addEventListener("click", handleClick, { capture: true });

    return () => {
      shadow.removeEventListener("contextmenu", preventContextMenu, { capture: true });
      shadow.removeEventListener("click", handleClick, { capture: true });
    };
  }, [
    notification.custom_css,
    notification.html_content,
    onFrameClick,
    onLinkClick,
  ]);

  return (
    <div
      ref={hostRef}
      className={className}
      role={onFrameClick ? "button" : undefined}
      tabIndex={onFrameClick ? 0 : undefined}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (!onFrameClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onFrameClick();
        }
      }}
    />
  );
}
