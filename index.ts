import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import {
  DOMParser,
  Element,
} from "https://deno.land/x/deno_dom@v0.1.35-alpha/deno-dom-wasm.ts";

const remapWhitelist: string[][] = [
  ["[src]", "src"],
  ["[href]", "href"],
  ["[srcset]", "srcset"],
  ["form[action]", "action"],
  ["meta[content][property='og:image']", "content"],
  ["meta[content][property='og:audio']", "content"],
  ["meta[content][property='og:video']", "content"],
  ["meta[name=msapplication-TileImage]", "content"],
  ["meta[itemprop=image]", "content"],
  ["meta[name=\"twitter:image\"]", "content"],
]

const port = 8080;
const parser = new DOMParser();
// make it a codespace URL if we're in a codespace
const base = Deno.env.get("CODESPACES") === "true" ?
  `https://${Deno.env.get("CODESPACE_NAME")}-8080.preview.app.github.dev/` :
  `http://localhost:${port}/`;

function safeURL(url: string, base?: string): URL | null {
  try {
    return new URL(url, base);
  } catch {
    return null;
  }
}

const relativizeAttribute = (el: Element, attribute: string, path: URL) => {
  const attr = el.getAttribute(attribute);

  if (attr) {
    const resolvedURL = safeURL(attr, `${path.protocol}//${path.host}/`);
    const newURL = base + resolvedURL;

    if (resolvedURL) {
      el.setAttribute(attribute, newURL);
    }
  }
};

const handler = async (request: Request): Promise<Response> => {
  const reqURL = new URL(request.url);
  const baseURL = new URL(base);
  // modify the URL to use the proxy base
  reqURL.protocol = baseURL.protocol;
  reqURL.host = baseURL.host;
  reqURL.port = baseURL.port;
  
  if (reqURL.href === base) {
    return new Response("ProxyPane Home page", { status: 200 });
  }

  if (reqURL.href === base + "proxy.js") {
    return new Response(
      await Deno.readTextFile("./proxy.js"),
      { headers: { "content-type": "text/javascript" } },
    );
  }

  const path = safeURL(reqURL.pathname.slice(1) + reqURL.search)

  if (!path) {
    return new Response("Invalid URL", { status: 400 });
  }

  const currentBase = base + `${path.protocol}//${path.host}/`;

  const response = await fetch(path, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
    }
  });
  const headers = new Headers(response.headers);
  // drop CSP headers
  headers.delete("content-security-policy");
  headers.delete("content-security-policy-report-only");
  // drop CORS headers
  headers.delete("access-control-allow-origin");
  headers.delete("access-control-allow-credentials");

  const type = response.headers.get("content-type");

  if (type?.includes("text/html")) {
    const html = await response.text();
    const doc = parser.parseFromString(html, "text/html");

    if (!doc) return new Response("Invalid HTML", { status: 400 });
    if (!doc.documentElement) {
      return new Response("Invalid HTML", { status: 400 });
    }

    // inject a meta tag to load the favicon IF it doesn't already exist
    const favicon = doc.querySelector("link[rel='icon']");
    if (!favicon) {
      const link = doc.createElement("link");
      link.setAttribute("rel", "icon");
      link.setAttribute("href", currentBase + "favicon.ico");
      doc.head.append(link);
    }

    for (const [selector, attribute] of remapWhitelist) {
      const links = doc.querySelectorAll(selector) ?? [];

      for (const link of links) {
        if (link instanceof Element) {
          const el = link as Element;
          relativizeAttribute(el, attribute, path);
        }
      }
    }


    // prepend a script tag to load our JS
    const script = doc.createElement("script");
    script.setAttribute("src", base + "proxy.js");
    doc.documentElement.prepend(script);

    // turn the doc back into a string
    const newHTML = doc.documentElement.outerHTML;

    if (newHTML) {
      return new Response(`<!DOCTYPE html>${newHTML}`, { headers });
    }

    return new Response(html, { headers });
  }

  // make a proxy
  const body = new Uint8Array(await response.arrayBuffer());

  return new Response(body, { headers });
};

await serve(handler, { port });
