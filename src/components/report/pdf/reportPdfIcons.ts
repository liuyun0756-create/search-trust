import { readFileSync } from "fs";
import { join } from "path";

function svgFileData(fileName: string) {
  const filePath = join(process.cwd(), "public", "icons", "report", fileName);
  const svg = readFileSync(filePath, "utf8");
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const REPORT_PDF_ICONS = {
  pageType: svgFileData("page-type.svg"),
  gbp: svgFileData("gbp.svg"),
  generated: svgFileData("generated.svg"),
  reportId: svgFileData("report-id.svg"),
  trust: svgFileData("trust-status.svg"),
  ranking: svgFileData("ranking-potential.svg"),
  risk: svgFileData("risk-level.svg"),
};
