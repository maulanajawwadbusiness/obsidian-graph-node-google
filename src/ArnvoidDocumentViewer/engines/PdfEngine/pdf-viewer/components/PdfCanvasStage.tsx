import type { RefObject } from "react";

type PdfCanvasStageProps = {
  stageRef: RefObject<HTMLDivElement | null>;
  stageContentRef: RefObject<HTMLDivElement | null>;
  frontCanvasRef: RefObject<HTMLCanvasElement | null>;
  backCanvasRef: RefObject<HTMLCanvasElement | null>;
  textLayerRef: RefObject<HTMLDivElement | null>;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

export function PdfCanvasStage({
  stageRef,
  stageContentRef,
  frontCanvasRef,
  backCanvasRef,
  textLayerRef,
  scrollContainerRef,
}: PdfCanvasStageProps) {
  return (
    <div className="canvas-wrap" ref={scrollContainerRef as any} data-arnvoid-scroll>
      <div className="canvas-stage" ref={stageRef as any}>
        <div className="canvas-stage-content" ref={stageContentRef as any}>
          <canvas ref={frontCanvasRef as any} className="pdf-canvas canvas-front" />
          <canvas ref={backCanvasRef as any} className="pdf-canvas canvas-back" />
          <div ref={textLayerRef as any} className="textLayer" />
        </div>
      </div>
    </div>
  );
}
