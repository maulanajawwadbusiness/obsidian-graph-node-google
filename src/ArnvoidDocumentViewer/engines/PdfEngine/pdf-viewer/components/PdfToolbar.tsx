import type { ChangeEvent } from "react";

type PdfToolbarProps = {
  pageNum: number;
  numPages: number;
  scale: number;
  isRendering: boolean;
  searchQuery: string;
  totalHits: number;
  currentHitIndex: number;
  textLayerStatus: "idle" | "building" | "ready" | "error";
  textLayerPage: number | null;
  onPrevPage: () => void;
  onNextPage: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onSearchChange: (value: string) => void;
  onPrevHit: () => void;
  onNextHit: () => void;
};

export function PdfToolbar({
  pageNum,
  numPages,
  scale,
  isRendering,
  searchQuery,
  totalHits,
  currentHitIndex,
  textLayerStatus,
  textLayerPage,
  onPrevPage,
  onNextPage,
  onZoomOut,
  onZoomIn,
  onSearchChange,
  onPrevHit,
  onNextHit,
}: PdfToolbarProps) {
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(event.target.value);
  };

  const statusLabel =
    textLayerStatus === "idle"
      ? "Idle"
      : textLayerStatus === "building"
        ? "Building"
        : textLayerStatus === "ready"
          ? "Ready"
          : "Error";

  return (
    <div className="toolbar">
      <button type="button" onClick={onPrevPage} disabled={pageNum <= 1}>
        Prev
      </button>
      <button
        type="button"
        onClick={onNextPage}
        disabled={pageNum >= (numPages || 1)}
      >
        Next
      </button>
      <div className="status">
        Page {pageNum} / {numPages || 1}
      </div>
      <button type="button" onClick={onZoomOut} disabled={isRendering}>
        -
      </button>
      <button type="button" onClick={onZoomIn} disabled={isRendering}>
        +
      </button>
      <div className="status">{Math.round(scale * 100)}%</div>
      <div className="search-box">
        <input
          className="search-input"
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Find in PDF"
        />
        <button type="button" onClick={onPrevHit} disabled={totalHits === 0}>
          Prev Hit
        </button>
        <button type="button" onClick={onNextHit} disabled={totalHits === 0}>
          Next Hit
        </button>
        <div className="search-count">
          {totalHits === 0 ? "0/0" : `${currentHitIndex + 1}/${totalHits}`}
        </div>
      </div>
      <div className={`search-status status-${textLayerStatus}`}>
        {statusLabel}
        {textLayerPage ? ` (P${textLayerPage})` : ""}
      </div>
    </div>
  );
}
