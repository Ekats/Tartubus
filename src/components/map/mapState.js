/** Nothing to do, or to clean up, once the map or its style is gone */
export const mapIsAlive = (map) => !!map && !map._removed && !!map.style;
/** Sources, layers and images can only be added to a loaded style; while one loads, `styleVersion` will follow */
export const styleIsReady = (map) => mapIsAlive(map) && !!map.style._loaded;
