import { serve } from "https://deno.land/std@0.187.0/http/server.ts";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.35-alpha/deno-dom-wasm.ts";

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

const handler = async (request: Request): Promise<Response> => {
    if (request.url === base) {
        return new Response("ProxyPane Home page", { status: 200 });
    }

    const url = new URL(request.url);
    const path = safeURL(url.pathname.slice(1));

    if (!path) {
        return new Response("Invalid URL", { status: 400 });
    }

    const response = await fetch(path);
    const headers = new Headers(response.headers);

    const requestBase = base + `${path.protocol}//${path.host}/`;
    console.log(requestBase);

    const type = response.headers.get("content-type");

    if (type?.includes("text/html")) {
        const html = await response.text();
        const doc = parser.parseFromString(html, "text/html");

        // modify all links to use our proxy as a base
        const links = doc?.querySelectorAll("[href]") ?? [];

        for (const link of links) {
            if (link instanceof Element) {
                const el = link as Element;
                const href = el.getAttribute("href");

                if (href) {
                    const resolvedURL = safeURL(href, `${path.protocol}//${path.host}/`);
                    const newURL = base + resolvedURL;
                    console.log(newURL);

                    if (resolvedURL) {
                        el.setAttribute("href", newURL);
                    }
                }
            }
        }

        // turn the doc back into a string
        const newHTML = doc?.documentElement?.outerHTML;

        if (newHTML) {
            return new Response(newHTML, { headers });
        }

        return new Response(html, { headers });
    }

    // make a proxy
    const body = new Uint8Array(await response.arrayBuffer());

    return new Response(body, { headers });
};


await serve(handler, { port });
