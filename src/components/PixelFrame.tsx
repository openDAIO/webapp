import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export const DEFAULT_PIXEL_FRAME = {
  color: '#7b5835',
  pixelSize: 4,
  thickness: 4,
  round: 0,
} as const;

interface PixelFrameChromeProps {
  color?: string;
  fillColor?: string;
  innerHighlightColor?: string;
  innerShadeColor?: string;
  outerShadowColor?: string;
  outerShadowOffsetX?: number;
  outerShadowOffsetY?: number;
  pixelSize?: number;
  thickness?: number;
  round?: number;
  steps?: number;
}

interface PixelFrameProps extends HTMLAttributes<HTMLDivElement>, PixelFrameChromeProps {
  children: ReactNode;
  className?: string;
}

const edgeStyle = (style: CSSProperties): CSSProperties => ({
  position: 'absolute',
  display: 'block',
  imageRendering: 'pixelated',
  ...style,
});

export function PixelFrameChrome({
  color = 'var(--pixel-frame-border, #7b5835)',
  fillColor = 'var(--pixel-frame-fill, #fff8e6)',
  innerHighlightColor,
  innerShadeColor,
  outerShadowColor = 'var(--pixel-frame-shadow-color, rgba(80, 53, 33, 0.25))',
  outerShadowOffsetX,
  outerShadowOffsetY,
  pixelSize,
  thickness = DEFAULT_PIXEL_FRAME.thickness,
  round,
  steps,
}: PixelFrameChromeProps) {
  const cornerSteps = Math.max(0, Math.floor(round ?? steps ?? DEFAULT_PIXEL_FRAME.round));
  const stepSize = thickness;
  const cornerInset = stepSize * cornerSteps;
  const edgeDrop = thickness + cornerInset;
  const blocks: CSSProperties[] = [];
  const fromRight = (value: number) => (value === 0 ? '100%' : `calc(100% - ${value}px)`);
  const fromBottom = (value: number) => (value === 0 ? '100%' : `calc(100% - ${value}px)`);
  const px = (value: number) => `${value}px`;

  const fillClipPath = (() => {
    if (cornerSteps === 0) return 'none';

    const points: string[] = [];

    points.push(`${px(cornerInset)} 0`);
    points.push(`${fromRight(cornerInset)} 0`);

    for (let step = 0; step < cornerSteps; step += 1) {
      points.push(`${fromRight(cornerInset - (step * stepSize))} ${px(thickness + (step * stepSize))}`);
      points.push(`${fromRight(cornerInset - ((step + 1) * stepSize))} ${px(thickness + (step * stepSize))}`);
    }

    points.push(`100% ${px(edgeDrop)}`);
    points.push(`100% ${fromBottom(edgeDrop)}`);

    for (let step = cornerSteps - 1; step >= 0; step -= 1) {
      points.push(`${fromRight(cornerInset - ((step + 1) * stepSize))} ${fromBottom(thickness + (step * stepSize))}`);
      points.push(`${fromRight(cornerInset - (step * stepSize))} ${fromBottom(thickness + (step * stepSize))}`);
    }

    points.push(`${fromRight(cornerInset)} 100%`);
    points.push(`${px(cornerInset)} 100%`);

    for (let step = 0; step < cornerSteps; step += 1) {
      points.push(`${px(cornerInset - (step * stepSize))} ${fromBottom(thickness + (step * stepSize))}`);
      points.push(`${px(cornerInset - ((step + 1) * stepSize))} ${fromBottom(thickness + (step * stepSize))}`);
    }

    points.push(`0 ${fromBottom(edgeDrop)}`);
    points.push(`0 ${px(edgeDrop)}`);

    for (let step = cornerSteps - 1; step >= 0; step -= 1) {
      points.push(`${px(cornerInset - ((step + 1) * stepSize))} ${px(thickness + (step * stepSize))}`);
      points.push(`${px(cornerInset - (step * stepSize))} ${px(thickness + (step * stepSize))}`);
    }

    return `polygon(${points.join(', ')})`;
  })();

  const fillStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'block',
    backgroundColor: fillColor,
    clipPath: fillClipPath,
    imageRendering: 'pixelated',
  };

  const shadowStyle: CSSProperties = {
    ...fillStyle,
    backgroundColor: outerShadowColor,
    transform: `translate(${outerShadowOffsetX !== undefined ? `${outerShadowOffsetX}px` : 'var(--pixel-frame-shadow-x, 4px)'}, ${outerShadowOffsetY !== undefined ? `${outerShadowOffsetY}px` : 'var(--pixel-frame-shadow-y, 4px)'})`,
  };

  const innerEffectColor = innerHighlightColor ?? innerShadeColor ?? 'var(--pixel-frame-inner-highlight, rgba(255, 255, 255, 0.42))';
  const innerShadeStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'block',
    clipPath: fillClipPath,
    imageRendering: 'pixelated',
    background:
      `linear-gradient(${innerEffectColor}, ${innerEffectColor}) top ${thickness}px left / 100% ${thickness}px no-repeat, ` +
      `linear-gradient(${innerEffectColor}, ${innerEffectColor}) top left ${thickness}px / ${thickness}px 100% no-repeat`,
  };

  if (cornerSteps === 0) {
    return (
      <>
        <span className="pixel-frame__shadow" style={shadowStyle} aria-hidden="true" />
        <span className="pixel-frame__fill" style={fillStyle} aria-hidden="true" />
        <span className="pixel-frame__inner-shade" style={innerShadeStyle} aria-hidden="true" />
        <span className="pixel-frame__chrome" aria-hidden="true">
          <span style={edgeStyle({ top: 0, left: 0, right: 0, height: thickness, backgroundColor: color })} />
          <span style={edgeStyle({ bottom: 0, left: 0, right: 0, height: thickness, backgroundColor: color })} />
          <span style={edgeStyle({ top: 0, bottom: 0, left: 0, width: thickness, backgroundColor: color })} />
          <span style={edgeStyle({ top: 0, bottom: 0, right: 0, width: thickness, backgroundColor: color })} />
        </span>
      </>
    );
  }

  for (let step = 0; step < cornerSteps; step += 1) {
    const outerOffset = (cornerSteps - step - 1) * stepSize;
    const stepOffset = thickness + (step * stepSize);

    blocks.push(
      { top: stepOffset, left: outerOffset },
      { top: stepOffset, right: outerOffset },
      { bottom: stepOffset, right: outerOffset },
      { bottom: stepOffset, left: outerOffset },
    );
  }

  const blockBase: CSSProperties = {
    position: 'absolute',
    display: 'block',
    width: stepSize,
    height: stepSize,
    backgroundColor: color,
    imageRendering: 'pixelated',
  };

  return (
    <>
      <span className="pixel-frame__shadow" style={shadowStyle} aria-hidden="true" />
      <span className="pixel-frame__fill" style={fillStyle} aria-hidden="true" />
      <span className="pixel-frame__inner-shade" style={innerShadeStyle} aria-hidden="true" />
      <span className="pixel-frame__chrome" aria-hidden="true">
        <span style={edgeStyle({ top: 0, left: cornerInset, right: cornerInset, height: thickness, backgroundColor: color })} />
        <span style={edgeStyle({ bottom: 0, left: cornerInset, right: cornerInset, height: thickness, backgroundColor: color })} />
        <span style={edgeStyle({ top: edgeDrop, bottom: edgeDrop, left: 0, width: thickness, backgroundColor: color })} />
        <span style={edgeStyle({ top: edgeDrop, bottom: edgeDrop, right: 0, width: thickness, backgroundColor: color })} />
        {blocks.map((block, index) => (
          <span key={index} style={{ ...blockBase, ...block }} />
        ))}
      </span>
    </>
  );
}

export default function PixelFrame({
  children,
  className = '',
  color,
  fillColor,
  innerHighlightColor,
  innerShadeColor,
  outerShadowColor,
  outerShadowOffsetX,
  outerShadowOffsetY,
  pixelSize,
  thickness,
  round,
  steps,
  ...props
}: PixelFrameProps) {
  return (
    <div className={`pixel-frame ${className}`} {...props}>
      {children}
      <PixelFrameChrome
        color={color}
        fillColor={fillColor}
        innerHighlightColor={innerHighlightColor}
        innerShadeColor={innerShadeColor}
        outerShadowColor={outerShadowColor}
        outerShadowOffsetX={outerShadowOffsetX}
        outerShadowOffsetY={outerShadowOffsetY}
        pixelSize={pixelSize}
        thickness={thickness}
        round={round}
        steps={steps}
      />
    </div>
  );
}
