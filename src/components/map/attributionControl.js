// The map credits behind an (i) button, in MapLibre's own look (its CSS classes).
//
// Not MapLibre's AttributionControl: its compact form opens itself the first time a style has credits
// and only closes on the first drag, so the box stood open whenever the map appeared and was moved by
// the app rather than by a finger (a route or a stop shown from another tab). This one is closed until
// the (i) is tapped, and closes again when the map is dragged.
import { MAP_ATTRIBUTION } from '../../utils/mapData';

const SHOWN = 'maplibregl-compact-show';

export class CollapsedAttributionControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement('div');
    this._container.className = 'maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact';
    this._button = document.createElement('button');
    this._button.type = 'button';
    this._button.className = 'maplibregl-ctrl-attrib-button';
    this._button.title = 'Map data';
    this._button.setAttribute('aria-label', 'Map data');
    this._button.setAttribute('aria-expanded', 'false');
    this._inner = document.createElement('div');
    this._inner.className = 'maplibregl-ctrl-attrib-inner';
    this._container.append(this._button, this._inner);

    this._toggle = () => this._show(!this._container.classList.contains(SHOWN));
    this._close = () => this._show(false);
    this._update = () => {
      const sources = Object.values(map.getStyle()?.sources || {});
      const credits = [...new Set(sources.map(source => source.attribution).filter(Boolean))];
      const key = credits.join('|');
      if (key === this._key) return;
      this._key = key;
      this._inner.replaceChildren(...credits.flatMap((credit, i) => {
        const span = document.createElement('span');
        // The app's own credit line carries links; anything a remote tile list says is shown as plain text
        if (credit === MAP_ATTRIBUTION) span.innerHTML = credit;
        else span.textContent = new DOMParser().parseFromString(credit, 'text/html').body.textContent;
        return i === 0 ? [span] : [' | ', span];
      }));
    };

    this._button.addEventListener('click', this._toggle);
    map.on('drag', this._close);
    // (the first 'styledata' fills it in: there is no style yet when the control is added)
    map.on('styledata', this._update);
    return this._container;
  }

  onRemove() {
    this._button.removeEventListener('click', this._toggle);
    this._map.off('drag', this._close);
    this._map.off('styledata', this._update);
    this._container.remove();
    this._map = undefined;
  }

  _show(shown) {
    this._container.classList.toggle(SHOWN, shown);
    this._button.setAttribute('aria-expanded', String(shown));
  }
}
