import { useEffect, useRef } from "react";

interface IsolatedHtmlContentProps {
  html: string;
  onLinkClick?: (url: string) => void;
}

function prepareHtml(html: string) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script, base, meta[http-equiv]").forEach((node) => node.remove());
  parsed.querySelectorAll("*").forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)) node.removeAttribute(attribute.name);
      if ((attribute.name === "href" || attribute.name === "src") && /^\s*javascript:/i.test(attribute.value)) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  parsed.querySelectorAll("iframe").forEach((iframe) => {
    iframe.removeAttribute("srcdoc");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
  });

  const headStyles = Array.from(parsed.head.querySelectorAll("style, link[rel='stylesheet']"))
    .map((node) => node.outerHTML)
    .join("\n");

  return `${headStyles}\n${parsed.body.innerHTML}`;
}

export function IsolatedHtmlContent({ html, onLinkClick }: IsolatedHtmlContentProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.replaceChildren();

    const baseStyle = document.createElement("style");
    baseStyle.textContent = `
      :host { display: block; width: 100%; color-scheme: dark; }
      *, *::before, *::after { box-sizing: border-box; }
      #espander-remote-content { display: flow-root; width: 100%; min-width: 0; }
      img, svg, video, canvas, iframe { max-width: 100%; }
      a { cursor: pointer; }
    `;

    const root = document.createElement("div");
    root.id = "espander-remote-content";
    root.innerHTML = prepareHtml(html);

    const fullWidthStyle = document.createElement("style");
    fullWidthStyle.textContent = `
      #espander-remote-content > :first-child,
      #espander-remote-content > :first-child > :first-child {
        width: 100% !important;
        max-width: none !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
    `;

    shadow.append(baseStyle, root, fullWidthStyle);

    const handleClick = (event: Event) => {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest("a") : null;
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;
      event.preventDefault();
      onLinkClick?.(anchor.href);
    };

    shadow.addEventListener("click", handleClick);
    return () => shadow.removeEventListener("click", handleClick);
  }, [html, onLinkClick]);

  return <div ref={hostRef} className="min-w-0 w-full" />;
}
