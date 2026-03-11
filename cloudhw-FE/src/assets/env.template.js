(function (window) {
    window['env'] = window['env'] || {};
    // Always use relative '/' — nginx proxies /api/* to the backend service.
    window['env']['BACKEND_URL'] = '/';
})(this);
