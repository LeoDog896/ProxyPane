var proxyPaneBase = `${window.location.protocol}//${window.location.host}/`;
var proxyPaneRequestURL = new URL(window.location.pathname.slice(1));

window.fetch = new Proxy(window.fetch, {
  apply: function (target, that, args) {
    console.log("fetch", that, args);
    // args holds argument of fetch function
    // Do whatever you want with fetch request
    return target.apply(that, args);
  },
});

window.XMLHttpRequest = new Proxy(window.XMLHttpRequest, {
    construct: function (target, args) {
      // make a new proxy of the target
      const request = new target(...args);

      // we want to intercept the URL passed to `open` (TODO)
      const open = request.open;

      request.open = function (method, url, ...args) {
        const base = proxyPaneBase;
        const reqURL = proxyPaneRequestURL;
        try {
          // rebase the URL
          const requestURL = new URL(url, reqURL.href);

          return open.call(request, method, base + requestURL, ...args);

        } catch (e) {
          // didn't work, pass through
          console.warn(e);
          return open.call(request, method, url, ...args);
        }
      }

      return request;
    },
});

// override appendChild to intercept script and link tags
window.HTMLElement.prototype.appendChild = new Proxy(window.HTMLElement.prototype.appendChild, {
  apply: function (target, that, args) {
    try {
      console.log("appendChild", args);
      const [child] = args;
      if (child.tagName === "SCRIPT" || child.tagName === "LINK") {
        const src = child.getAttribute("src");
        if (src) {
          const srcURL = new URL(src, proxyPaneRequestURL.href);

          child.setAttribute("src", proxyPaneBase + srcURL);
        }
      }
      return target.apply(that, args);
    } catch (e) {
      console.warn(e);
      return target.apply(that, args);
    }
  },
});