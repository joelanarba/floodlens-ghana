import { BaseMapStyleId } from '../types/geospatial';

export interface BaseMapConfig {
  id: BaseMapStyleId;
  label: string;
  providerBadge: string;
  styleUrl: string;
  isAwsLocation: boolean;
}

const CARTO_POSITRON_STYLE =
  'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const CARTO_DARK_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export function getBaseMapConfig(styleId: BaseMapStyleId): BaseMapConfig {
  const region = import.meta.env.VITE_AWS_REGION || 'us-east-1';
  const lightMap =
    import.meta.env.VITE_AWS_LOCATION_MAP_LIGHT || 'floodlens-mapit-2026-light';
  const darkMap =
    import.meta.env.VITE_AWS_LOCATION_MAP_DARK || 'floodlens-mapit-2026-dark';
  const apiKey = (import.meta.env.VITE_AWS_LOCATION_API_KEY || '').trim();

  const hasValidAwsKey =
    apiKey.length > 20 &&
    apiKey !== 'your_restricted_amazon_location_service_api_key_here';

  if (styleId === 'aws-light') {
    if (hasValidAwsKey) {
      return {
        id: 'aws-light',
        label: 'AWS Dataviz Light',
        providerBadge: `Amazon Location Service (${lightMap})`,
        styleUrl: `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${lightMap}/style-descriptor?key=${encodeURIComponent(
          apiKey
        )}`,
        isAwsLocation: true,
      };
    }
    return {
      id: 'aws-light',
      label: 'Light Cartographic',
      providerBadge: 'Open Vector Basemap (Local Fallback)',
      styleUrl: CARTO_POSITRON_STYLE,
      isAwsLocation: false,
    };
  }

  if (styleId === 'aws-dark') {
    if (hasValidAwsKey) {
      return {
        id: 'aws-dark',
        label: 'AWS Dataviz Dark',
        providerBadge: `Amazon Location Service (${darkMap})`,
        styleUrl: `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${darkMap}/style-descriptor?key=${encodeURIComponent(
          apiKey
        )}`,
        isAwsLocation: true,
      };
    }
    return {
      id: 'aws-dark',
      label: 'Dark Cartographic',
      providerBadge: 'Open Vector Basemap (Local Fallback)',
      styleUrl: CARTO_DARK_STYLE,
      isAwsLocation: false,
    };
  }

  return {
    id: 'carto-positron',
    label: 'Open Cartographic',
    providerBadge: 'OpenStreetMap / CARTO Vector',
    styleUrl: CARTO_POSITRON_STYLE,
    isAwsLocation: false,
  };
}

export function getFallbackStyleUrl(styleId: BaseMapStyleId): string {
  return styleId === 'aws-dark' ? CARTO_DARK_STYLE : CARTO_POSITRON_STYLE;
}
