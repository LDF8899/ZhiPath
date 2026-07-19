import { useEffect, useRef, useState } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';
import { IconMapPin } from './icons';

interface InteractiveCompanyMapProps {
  longitude: number;
  latitude: number;
  companyName: string;
  staticImage?: string | null;
}

export default function InteractiveCompanyMap({
  longitude,
  latitude,
  companyName,
  staticImage,
}: InteractiveCompanyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [activated, setActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(13);

  useEffect(() => {
    if (!activated || !containerRef.current || mapRef.current) return;
    const key = import.meta.env.VITE_AMAP_WEB_KEY || '';
    const securityJsCode = import.meta.env.VITE_AMAP_SECURITY_JS_CODE || '';
    if (!key || !securityJsCode) {
      setError(true);
      return;
    }

    let disposed = false;
    setLoading(true);
    (window as any)._AMapSecurityConfig = { securityJsCode };
    AMapLoader.load({
      key,
      version: '2.0',
      plugins: ['AMap.Scale', 'AMap.ToolBar'],
    })
      .then((AMap) => {
        if (disposed || !containerRef.current) return;
        const map = new AMap.Map(containerRef.current, {
          center: [longitude, latitude],
          zoom: 13,
          viewMode: '2D',
          scrollWheel: true,
          dragEnable: true,
          doubleClickZoom: true,
        });
        map.setStatus({
          scrollWheel: true,
          dragEnable: true,
          doubleClickZoom: true,
          zoomEnable: true,
        });
        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: 'RT' }));
        const marker = new AMap.Marker({
          position: [longitude, latitude],
          title: companyName,
          anchor: 'bottom-center',
        });
        map.add(marker);
        map.on('zoomchange', () => setZoom(map.getZoom()));
        mapRef.current = map;
        setLoading(false);
      })
      .catch(() => {
        if (!disposed) {
          setLoading(false);
          setError(true);
        }
      });

    return () => {
      disposed = true;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [activated, companyName, latitude, longitude]);

  return (
    <div
      data-map-zoom={zoom}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '7 / 3.2',
        minHeight: 210,
        overflow: 'hidden',
        border: '1px solid var(--rule)',
        borderRadius: 6,
        background: 'var(--paper-tint)',
      }}
    >
      {!activated && staticImage && (
        <img
          src={staticImage}
          alt={`${companyName}位置地图`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {!activated && (
        <button
          type="button"
          onClick={() => setActivated(true)}
          aria-label="激活交互地图"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: 0,
            background: 'rgba(20,20,19,0.12)',
            color: '#141413',
            cursor: 'pointer',
            font: '700 14px/1 var(--hand-bold)',
          }}
        >
          <span style={{ padding: '10px 14px', border: '1.5px solid #141413', borderRadius: 6, background: 'rgba(250,249,245,.94)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconMapPin size={16} /> 点击激活地图
            </span>
          </span>
        </button>
      )}
      {activated && loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'var(--paper-tint)', color: 'var(--pencil)', font: '13px/1 var(--hand)' }}>
          正在加载交互地图...
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 20, textAlign: 'center', background: 'var(--paper-tint)', color: 'var(--pencil)', font: '13px/1.5 var(--hand)' }}>
          交互地图加载失败，可使用上方“查看地图”打开高德地图。
        </div>
      )}
      {activated && !loading && !error && (
        <div style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 500, padding: '5px 8px', borderRadius: 4, background: 'rgba(250,249,245,.9)', color: '#6c6a64', font: '11px/1.2 var(--hand)', pointerEvents: 'none' }}>
          滚轮缩放 · 按住拖动
        </div>
      )}
    </div>
  );
}
