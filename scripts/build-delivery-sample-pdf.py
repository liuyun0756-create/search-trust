"""Build the public, fictional delivery sample from the website's shared copy.

Requires reportlab. Run from any directory; no business APIs or client data.
"""
from functools import partial
from hashlib import sha256
import json
from pathlib import Path
import shutil
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak, HRFlowable, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/components/framework/delivery-example.json"
source_bytes = SOURCE.read_bytes()
data = json.loads(source_bytes)
output = ROOT / "output/pdf/searchtrust-client-delivery-example.pdf"
public = ROOT / "public/samples/searchtrust-client-delivery-example.pdf"
output.parent.mkdir(parents=True, exist_ok=True)
public.parent.mkdir(parents=True, exist_ok=True)

ink, muted, green = colors.HexColor("#1d2a22"), colors.HexColor("#647466"), colors.HexColor("#57805b")
styles = {
    "tag": ParagraphStyle("tag", fontName="Helvetica-Bold", fontSize=8, leading=12, textColor=green, spaceAfter=12),
    "title": ParagraphStyle("title", fontName="Times-Roman", fontSize=25, leading=30, textColor=ink, spaceAfter=14),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=15, textColor=muted, spaceAfter=9),
    "label": ParagraphStyle("label", fontName="Helvetica-Bold", fontSize=10, leading=15, textColor=ink, spaceBefore=9, spaceAfter=4),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.5, leading=12.5, textColor=muted, spaceAfter=9),
}

def para(text, style="body"):
    return Paragraph(escape(text), styles[style])

def block(label, text):
    return KeepTogether([para(label, "label"), para(text)])

def line():
    return HRFlowable(width="100%", thickness=0.6, color=colors.HexColor("#e3eae2"), spaceBefore=8, spaceAfter=14)

def page_header(label, title):
    return [para(label.upper(), "tag"), para(title, "title"), para(data["label"], "small"), line()]

def footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(colors.HexColor("#f2f7f1"))
    canvas.rect(0, A4[1] - 11, A4[0], 11, stroke=0, fill=1)
    canvas.setFillColor(ink)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(42, A4[1] - 31, "SearchTrust / Client delivery sample")
    canvas.setStrokeColor(colors.HexColor("#e3eae2"))
    canvas.line(42, 44, A4[0] - 42, 44)
    canvas.setFillColor(muted)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(42, 30, "Fictional example. Not a client report or verified result.")
    canvas.drawRightString(A4[0] - 42, 30, f"{data['version']}  /  {doc.page}")
    canvas.restoreState()

view = data["views"]["client"]
story = page_header("01 / Client report view", view["title"])
story += [para(data["case"], "small"), para(data["scope"], "small"), para(view["intro"])]
story += [para("Why this work is proposed - illustrative evidence", "label")]
for evidence in data["evidence"]:
    story.append(para(f"{evidence['source']}: {evidence['text']}"))
for section in view["sections"]:
    story.append(block(section["label"], section["text"]))
story += [para("The conditions, work status and limits on the following page are part of this explanation, not optional fine print.", "small"), PageBreak()]

story += page_header("02 / Conditions and delivery review", "Clear expression keeps the important limits visible.")
story += [para("Still to confirm, in either view", "label")]
story += [para(f"{i + 1}. {text}") for i, text in enumerate(data["pending"])]
story += [block("What this does not establish", data["limitations"]), line()]
story += [block(item["label"], item["text"]) for item in data["status"]]
story += [line(), block("Before a real delivery", "The SEO reviews the judgment, confirms the action plan and previews the client's report. Confirm the report version, client-visible content, pending conditions and whether later edits require a newly approved delivery version."), para("This static PDF is a website demonstration. It does not create a share link, record approval, edit a real report or send anything to a client. Real-workspace capability alignment is pending.", "small"), PageBreak()]

for index, scenario in enumerate(data["scenarios"]):
    story += page_header(f"0{index + 3} / {scenario['label']}", scenario["title"])
    story += [para(scenario["summary"]), para("Representative evidence in the example", "label")]
    story += [para(text) for text in scenario["evidence"]]
    story += [para("Three proposed actions" if scenario["id"] == "prospect" else "Plan, implementation and review", "label")]
    story += [para(f"{i + 1}. {text}") for i, text in enumerate(scenario["actions"])]
    story += [block("Client confirmation", scenario["needs"]), block("Still to verify" if scenario["id"] == "prospect" else "Actual status", scenario["boundary"]), line(), para(scenario["value"])]
    if index == 0:
        story.append(PageBreak())

doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=42, leftMargin=42, topMargin=60, bottomMargin=60,
                        title="SearchTrust - Fictional client delivery example", author="SearchTrust",
                        subject="Website example, not client evidence. source-sha256:" + sha256(source_bytes).hexdigest())
doc.build(story, onFirstPage=footer, onLaterPages=footer, canvasmaker=partial(Canvas, invariant=1))
shutil.copyfile(output, public)
print(f"Generated {public}")
