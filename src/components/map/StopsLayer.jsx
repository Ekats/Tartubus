// The stops, drawn by the map itself (not HTML markers), grouped into clusters while zoomed out.
import { useMemo } from 'react';
import { pointCollection } from '../../utils/mapFeatures';
import { useMapContext, useGeoJsonLayers, useMapEvent, useClickableLayers, useStableValue, mapIsAlive } from './mapContext';
import { CLUSTER_STAR } from './mapIcons';
import { MAP_FONT, MAP_FONT_BOLD } from './mapStyle';

const SOURCE = 'stops';
// Cluster colours of leaflet.markercluster's default theme: small (<10), medium (<100), large
const bySize = (small, medium, large) => ['step', ['get', 'point_count'], small, 10, medium, 100, large];
const isCluster = ['has', 'point_count'];
const withFavorite = ['>', ['get', 'favorites'], 0];

const LAYERS = [
  {
    id: 'stop-cluster-halo',
    type: 'circle',
    filter: ['all', isCluster, ['!', withFavorite]],
    paint: {
      'circle-radius': 20,
      'circle-color': bySize('rgba(181, 226, 140, 0.6)', 'rgba(241, 211, 87, 0.6)', 'rgba(253, 156, 115, 0.6)'),
    },
  },
  {
    id: 'stop-cluster',
    type: 'circle',
    filter: ['all', isCluster, ['!', withFavorite]],
    paint: {
      'circle-radius': 15,
      'circle-color': bySize('rgba(110, 204, 57, 0.6)', 'rgba(240, 194, 12, 0.6)', 'rgba(241, 128, 23, 0.6)'),
    },
  },
  {
    id: 'stop-cluster-count',
    type: 'symbol',
    filter: ['all', isCluster, ['!', withFavorite]],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': MAP_FONT,
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#000000' },
  },
  // A cluster holding a favourite stop: a star instead of the coloured disc
  {
    id: 'stop-cluster-favorite',
    type: 'symbol',
    filter: ['all', isCluster, withFavorite],
    layout: {
      'icon-image': CLUSTER_STAR,
      'icon-allow-overlap': true,
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': MAP_FONT_BOLD,
      'text-size': 14,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#78350f', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  },
  {
    id: 'stop',
    type: 'symbol',
    filter: ['!', isCluster],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-allow-overlap': true,
      // Favourites on top of their neighbours
      'symbol-sort-key': ['case', ['get', 'favorite'], 1, 0],
    },
  },
];
const CLICKABLE = ['stop', 'stop-cluster', 'stop-cluster-halo', 'stop-cluster-favorite'];
const icons = (data) => [CLUSTER_STAR, ...data.features.map(feature => feature.properties.icon)];

/**
 * @param points - [{ id, lat, lon, icon, favorite }] (see stopPoints in utils/mapFeatures.js)
 * @param clusterMaxZoom - the last MapLibre zoom level with clusters
 * @param onStopClick(id)
 */
function StopsLayer({ points, clusterMaxZoom, onStopClick }) {
  const { map } = useMapContext();
  const stablePoints = useStableValue(points);
  const data = useMemo(() => pointCollection(stablePoints), [stablePoints]);

  useGeoJsonLayers({
    sourceId: SOURCE,
    data,
    sourceOptions: {
      cluster: true,
      clusterRadius: 40,
      clusterMaxZoom,
      clusterProperties: { favorites: ['+', ['case', ['get', 'favorite'], 1, 0]] },
    },
    layers: LAYERS,
    icons,
  });
  useClickableLayers(CLICKABLE);

  useMapEvent('click', 'stop', (e) => onStopClick?.(e.features[0].properties.id));

  // A tap on a cluster zooms in until it splits
  const zoomIntoCluster = async (e) => {
    const cluster = e.features[0];
    const zoom = await map.getSource(SOURCE).getClusterExpansionZoom(cluster.properties.cluster_id);
    if (mapIsAlive(map)) map.easeTo({ center: cluster.geometry.coordinates, zoom });
  };
  useMapEvent('click', 'stop-cluster', zoomIntoCluster);
  useMapEvent('click', 'stop-cluster-favorite', zoomIntoCluster);

  return null;
}

export default StopsLayer;
