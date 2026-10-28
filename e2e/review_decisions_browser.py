"""Real Next page, synthetic decision API, loopback only. No customer services.

Run Next with the local E2E identity and all four review workspace flags.
The separate native integration suite covers the real HTTP-to-database path.
"""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--chrome', default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args = parser.parse_args()
assert urlparse(args.base_url).hostname in ('localhost', '127.0.0.1')
args.output.mkdir(parents=True, exist_ok=True)
fixture = json.loads((Path(__file__).resolve().parents[1] / 'src/lib/review-decisions/contracts/fixture.json').read_text())
evidence, template = fixture['context'], fixture['revision']
template['user_id'] = 'e2000000-0000-4000-8000-000000000001'
records, writes, external, errors = [], [], [], []
mode = 'normal'
base = f"/cases/{template['case_id']}/reports/{template['report_id']}/review-decisions?reviewId={template['review_id']}"


def digest(value):
    # Receipt test data uses strings and small integers only.
    body = json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return 'sha256:' + hashlib.sha256(body.encode()).hexdigest()


def route(r):
    global mode
    req, url = r.request, urlparse(r.request.url)
    if url.hostname not in ('localhost', '127.0.0.1'):
        external.append(url.hostname)
        r.abort()
        return
    if '/api/v2/cases/' not in url.path or not url.path.endswith('/review-decisions'):
        r.continue_()
        return
    body = req.post_data_json if req.method == 'POST' else {k: v[0] for k, v in parse_qs(url.query).items()}
    operation = body['operation']
    status = 200
    if operation == 'context':
        value = evidence
    elif operation == 'history':
        value = dict(review_id=template['review_id'], report_id=template['report_id'], next_cursor=None,
                     items=[{k: row[k] for k in ('id', 'revision', 'previous_id', 'recorded_at', 'checksum')} |
                            dict(decision_count=len(row['decisions'])) for row in records])
    elif operation == 'read':
        value = next((row for row in records if row['id'] == body['decision_id']), None)
        if value is None:
            status, value = 404, dict(code='UNAVAILABLE')
    elif operation == 'save':
        writes.append(deepcopy(body))
        if mode == 'stale':
            status, value = 409, dict(code='STALE')
        else:
            request = body['request']
            value = next((row for row in records if row['id'] == request['id']), None)
            if value is None:
                value = deepcopy(template) | deepcopy(request) | dict(revision=len(records)+1)
                value['request_checksum'] = digest(request)
                value['checksum'] = digest({k: v for k, v in value.items() if k != 'checksum'})
                records.insert(0, value)
            if mode == 'lost':
                mode = 'normal'
                r.abort()
                return
    else:
        raise AssertionError(operation)
    r.fulfill(status=status, content_type='application/json', body=json.dumps(value),
              headers={'Cache-Control': 'private, no-store'})


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=args.chrome, headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, locale='en-US', timezone_id='UTC')
    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda dialog: dialog.accept())

    def screenshot(name):
        page.evaluate("window.scrollTo({top:0,behavior:'instant'})")
        page.screenshot(path=str(args.output / name), full_page=True)
        overflow = page.evaluate('''() => [...document.querySelectorAll('main *')].filter(e => {
          const r=e.getBoundingClientRect();return r.width && r.right>innerWidth+1 && getComputedStyle(e).position!=='absolute';
        }).slice(0,12).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width}))''')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), overflow

    def save():
        page.get_by_role('button', name='Review & save →').click()
        dialog = page.get_by_role('dialog')
        expect(dialog).to_be_visible()
        button = dialog.get_by_role('button', name='Save version · 0 credits')
        expect(button).to_be_disabled()
        dialog.get_by_role('checkbox').check()
        button.click()

    response = page.goto(args.base_url + base)
    assert response.headers.get('referrer-policy') == 'no-referrer'
    assert 'noindex' in response.headers.get('x-robots-tag', '')
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('heading', name='What should happen next?')).to_be_visible(timeout=60000)
    assert page.get_by_role('radio', checked=True).count() == 0
    page.get_by_role('radio', name=re.compile('Adjust')).check()
    page.get_by_role('button', name='Review & save →').click()
    expect(page.get_by_label('Why this decision?')).to_be_focused()
    page.get_by_label('Why this decision?').fill('The contact path needs an explicit next step before another page is proposed.')
    page.get_by_role('checkbox').first.check()
    screenshot('decisions-desktop.png')
    save()
    expect(page.get_by_text('Read-only history', exact=True)).to_be_visible()
    assert len(writes) == len(records) == 1
    expect(page.get_by_role('textbox')).to_have_count(0)
    first = deepcopy(records[0])
    screenshot('decisions-saved.png')

    page.get_by_role('button', name='Edit a new version →').click()
    page.get_by_role('radio', name=re.compile('Defer')).check()
    expect(page.get_by_label(re.compile('^Target'))).to_have_count(0)
    page.get_by_label('Reconsider when…').fill('When the client confirms which service area is current.')
    mode = 'lost'
    save()
    expect(page.get_by_text('Save result needs checking', exact=True)).to_be_visible()
    marker = page.evaluate("Object.values(sessionStorage).map(v=>JSON.parse(v))")
    assert len(marker) == 1 and len(marker[0]) == 5
    assert 'reason' not in marker[0]
    page.reload()
    page.wait_for_load_state('networkidle')
    expect(page.get_by_text('Save result needs checking', exact=True)).to_be_visible()
    assert len(writes) == 2
    page.get_by_role('button', name='Check this save', exact=True).click()
    expect(page.get_by_text('Save result needs checking', exact=True)).to_have_count(0)
    expect(page.get_by_text('Read-only history', exact=True)).to_be_visible()
    assert len(writes) == len(records) == 2 and records[1] == first
    page.get_by_role('button', name=re.compile(r'^Version 1')).click()
    expect(page.get_by_text(first['decisions'][0]['reason'], exact=True)).to_be_visible()
    expect(page.get_by_role('textbox')).to_have_count(0)
    page.get_by_role('button', name='Edit a new version →').click()
    expect(page.get_by_label('Reconsider when…')).to_have_value('When the client confirms which service area is current.')
    page.get_by_role('radio', name=re.compile('Observe')).check()
    page.get_by_label('Your completion statement').fill('I checked the published contact step against the approved work.')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.get_by_role('link', name='Jump to decision editor ↓').click()
    expect(page.get_by_label('Your completion statement')).to_be_visible()
    screenshot('decisions-mobile.png')
    page.get_by_role('button', name=re.compile('Propose new work')).click()
    expect(page.get_by_label(re.compile('^Target'))).to_have_value('')
    page.get_by_role('button', name='Remove proposed work', exact=True).click()
    expect(page.get_by_label('Your completion statement')).to_have_value('I checked the published contact step against the approved work.')
    mode = 'stale'
    save()
    expect(page.get_by_text(re.compile('A newer decision version exists'))).to_be_visible()
    expect(page.get_by_role('button', name='Review & save →')).to_be_disabled()
    assert len(records) == 2 and len(writes) == 3
    screenshot('decisions-conflict-mobile.png')
    assert not errors, errors
    browser.close()
print('PASS: real page, focus, conditional fields, explicit save, immutable history, latest-version editing, lost-response refresh recovery, conflict preservation and 390px layout. External requests blocked:', len(external))
