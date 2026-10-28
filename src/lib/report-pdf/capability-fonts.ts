import path from "node:path";
import { Font } from "@react-pdf/renderer";
import { openSync } from "fontkit";

const regular=path.join(process.cwd(),"public/fonts/capability/ReportSans-Regular.ttf");
const bold=path.join(process.cwd(),"public/fonts/capability/ReportSans-Bold.ttf");
Font.register({family:"CapabilitySans",src:regular});
Font.register({family:"CapabilitySansBold",src:bold});
let fonts:ReturnType<typeof openSync>[]|undefined;
export function assertCapabilityPdfText(text:string) {
  fonts ??= [openSync(regular),openSync(bold)];
  for(const character of text) {
    if(/[\t\n\r]/.test(character)) continue;
    if(!fonts.every(font=>font.hasGlyphForCodePoint(character.codePointAt(0)!))) throw new Error("CAPABILITY_PDF_UNSUPPORTED_TEXT");
  }
}
