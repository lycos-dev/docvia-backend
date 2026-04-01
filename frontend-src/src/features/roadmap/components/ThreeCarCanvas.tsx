import { forwardRef } from 'react';

interface ThreeCarCanvasProps {
  width: number;
  height: number;
  /** Z-index offset so the canvas sits above the SVG road */
  zIndex?: number;
}

/**
 * A transparent <canvas> that Three.js renders into.
 * Positioned absolutely over the SVG road container.
 * pointer-events: none so SVG milestone clicks still work.
 */
const ThreeCarCanvas = forwardRef<HTMLCanvasElement, ThreeCarCanvasProps>(
  ({ width, height, zIndex = 2 }, ref) => {
    return (
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',   // SVG underneath still receives clicks
          zIndex,
        }}
        aria-hidden="true"
      />
    );
  }
);

ThreeCarCanvas.displayName = 'ThreeCarCanvas';

export default ThreeCarCanvas;