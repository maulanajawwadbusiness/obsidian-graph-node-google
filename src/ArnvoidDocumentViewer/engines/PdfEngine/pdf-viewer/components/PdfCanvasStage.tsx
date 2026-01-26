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
    <div className="canvas-wrap" ref={scrollContainerRef} data-arnvoid-scroll>
      <div className="canvas-stage" ref={stageRef}>
        <div className="canvas-stage-content" ref={stageContentRef}>
          <canvas ref={frontCanvasRef} className="pdf-canvas canvas-front" />
          <canvas ref={backCanvasRef} className="pdf-canvas canvas-back" />
          <div ref={textLayerRef} className="textLayer" />
        </div>
      </div>
    </div>
  );
}
