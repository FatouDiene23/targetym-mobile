// Patch chargé en TOUT premier (synchrone) — avant tous les autres scripts
// Corrige le bug "Failed to construct 'Image'" sur Capacitor Android
(function () {
  if (typeof window === 'undefined') return;
  try {
    var _NativeImage = window.Image;
    function ImageWrapper(w, h) {
      return new _NativeImage(w, h);
    }
    ImageWrapper.prototype = _NativeImage.prototype;
    Object.defineProperty(window, 'Image', {
      configurable: true,
      writable: true,
      value: new Proxy(_NativeImage, {
        apply: function (target, thisArg, args) {
          return new target(args[0], args[1]);
        },
        construct: function (target, args) {
          return new target(args[0], args[1]);
        }
      })
    });
  } catch (e) {
    console.warn('Image patch failed:', e);
  }
})();
