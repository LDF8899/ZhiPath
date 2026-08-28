import GeoGebraFigure from './GeoGebraFigure';
import ThreeFigure from './ThreeFigure';

/** 按 figure.type 分发：几何/函数/2D→GeoGebra；工程/建筑 3D 模型→three.js */
export default function FigureRenderer({ figure, width = 640, height = 420 }: { figure: any; width?: number; height?: number }) {
  if (!figure) return null;
  if (figure.type === 'three') {
    return <ThreeFigure scene={figure.scene} camera={figure.camera} axes={figure.axes !== false} width={width} height={height} />;
  }
  if (figure.type === 'geogebra') {
    return <GeoGebraFigure type="geogebra" commands={figure.commands || []} view={figure.view} axes={figure.axes !== false} grid={!!figure.grid} view3d={!!figure.view3d} width={width} height={height} />;
  }
  return null;
}
