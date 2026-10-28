"""Local generated-fixture PDF checks and page contact sheets, not customer data."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("directory",type=Path)
    args=parser.parse_args()
    reports=[]
    for name in ("public-0","public-3","service-first","service-measurement"):
        reader=PdfReader(args.directory/f"{name}.pdf")
        pages=[]
        for index,page in enumerate(reader.pages,1):
            outside=[]
            def visitor(text,cm,tm,font,size):
                if not text.strip(): return
                x=tm[4]*cm[0]+tm[5]*cm[2]+cm[4]
                y=tm[4]*cm[1]+tm[5]*cm[3]+cm[5]
                if not (20 <= x <= 580 and 12 <= y <= 825): outside.append((round(x,1),round(y,1)))
            pages.append(page.extract_text(visitor_text=visitor))
            if outside: raise SystemExit(f"Text outside page bounds: {name} / {index} / {outside[:3]}")
        text=" ".join(" ".join(pages).split())
        if "SEO-approved client summary, retained in the PDF" not in text:
            raise SystemExit(f"Approved summary missing: {name}")
        if name!="public-0" and "SEO-approved execution material, retained in the PDF" not in text:
            raise SystemExit(f"Approved material missing: {name}")
        if any(len(page.strip())<45 for page in pages): raise SystemExit(f"Empty/orphan page: {name}")
        if name.startswith("service-") and ("750" not in text or "2026-08-29" not in text):
            raise SystemExit(f"Expected evidence missing: {name}")
        if name.startswith("service-") and "The eligible saved website fields below were checked." not in text:
            raise SystemExit(f"Embedded font text mapping changed: {name}")
        thumbs=[]
        # Poppler determines the PNG filenames; match exactly the current PDF's pages.
        for index in range(1,len(pages)+1):
            choices=[args.directory/f"{name}-{str(index).zfill(width)}.png" for width in (1,2,3)]
            image_path=next((p for p in choices if p.exists()),None)
            if image_path is None: raise SystemExit(f"Render PDF pages before inspecting: {name} page {index}")
            with Image.open(image_path) as source:
                thumbnail=source.convert("RGB")
            thumbnail.thumbnail((270,390))
            tile=Image.new("RGB",(290,415),"#e8eee8")
            tile.paste(thumbnail,((290-thumbnail.width)//2,20))
            ImageDraw.Draw(tile).text((10,399),f"{name} / {index}",fill="#213d32")
            thumbs.append(tile)
        rows=(len(thumbs)+3)//4
        sheet=Image.new("RGB",(1160,rows*415),"white")
        for i,tile in enumerate(thumbs): sheet.paste(tile,((i%4)*290,(i//4)*415))
        sheet.save(args.directory/f"{name}-contact-sheet.png")
        reports.append({"name":name,"pages":len(pages),"characters":len(text),"approved_content_present":True})
    multilingual=args.directory/"multilingual.pdf"
    if multilingual.exists():
        reader=PdfReader(multilingual)
        text=" ".join(page.extract_text() for page in reader.pages)
        for expected in ("客户诊断报告", "Café", "先确认现有服务页面，再讨论下一步。"):
            if expected not in text: raise SystemExit(f"Multilingual text missing: {expected}")
        reports.append({"name":"multilingual","pages":len(reader.pages),"chinese_accented_text_present":True})
    print(json.dumps({"ok":True,"reports":reports}))


if __name__=="__main__": main()
