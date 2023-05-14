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
        console.log("XML:", args);
      return new target(...args);
    },
});