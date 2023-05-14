import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import {
  DOMParser,
  Element,
} from "https://deno.land/x/deno_dom@v0.1.35-alpha/deno-dom-wasm.ts";

const port = 8080;
const parser = new DOMParser();
const base = "http://localhost:8080/";

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
    if (el.tagName === "IMG") console.log(attr, newURL);

    if (resolvedURL) {
      el.setAttribute(attribute, newURL);
    }
  }
};

const handler = async (request: Request): Promise<Response> => {
  if (request.url === base) {
    return new Response("ProxyPane Home page", { status: 200 });
  }

  if (request.url === base + "proxy.js") {
    return new Response(
      await Deno.readTextFile("./proxy.js"),
      { headers: { "content-type": "text/javascript" } },
    );
  }

  const url = new URL(request.url);
  const path = safeURL(url.pathname.slice(1));

  if (!path) {
    return new Response("Invalid URL", { status: 400 });
  }

  const response = await fetch(path);
  const headers = new Headers(response.headers);
  headers.delete("content-security-policy");
  headers.delete("content-security-policy-report-only");

  const type = response.headers.get("content-type");

  if (type?.includes("text/html")) {
    const html = await response.text();
    const doc = parser.parseFromString(html, "text/html");

    if (!doc) return new Response("Invalid HTML", { status: 400 });
    if (!doc.documentElement) {
      return new Response("Invalid HTML", { status: 400 });
    }

    // modify all links to use our proxy as a base
    const links = doc.querySelectorAll("[href], [src]") ?? [];

    for (const link of links) {
      if (link instanceof Element) {
        const el = link as Element;
        relativizeAttribute(el, "href", path);
        relativizeAttribute(el, "src", path);
      }
    }

    // prepend a script tag to load our JS
    const script = doc.createElement("script");
    script.setAttribute("type", "module");
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
