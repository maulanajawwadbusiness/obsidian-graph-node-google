import express from "express";

export type JsonParserConfig = {
  savedInterfacesJsonLimit: string;
  globalJsonLimit: string;
};

export function applyJsonParsers(app: express.Express, cfg: JsonParserConfig): void {
  const savedInterfacesJsonParser = express.json({ limit: cfg.savedInterfacesJsonLimit });
  app.use("/api/saved-interfaces", (req, res, next) => savedInterfacesJsonParser(req, res, next));

  const globalJsonParser = express.json({ limit: cfg.globalJsonLimit });
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/saved-interfaces")) {
      next();
      return;
    }
    globalJsonParser(req, res, next);
  });

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === "entity.too.large" && req.path.startsWith("/api/saved-interfaces")) {
      res.status(413).json({ ok: false, error: "saved interface payload too large" });
      return;
    }
    next(err);
  });
}
