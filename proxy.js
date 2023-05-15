const base = `${window.location.protocol}//${window.location.host}/`;
const requestURL = new URL(window.location.pathname.slice(1));

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
        console.log("XMLHttpRequest", url);
        // call the original `open` with all original arguments
        return open.call(request, method, url, ...args);
      }

      return request;
    },
});