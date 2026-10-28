"""Local-only browser acceptance with synthetic API responses; never contacts customer services.

Start Next with the existing loopback E2E identity and the three workspace gates
in the test process only. Run with Python Playwright, --base-url and --output.
Screenshots contain synthetic contract evidence, never customer records.
"""
import argparse
from copy import deepcopy
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode
from playwright.sync_api import sync_playwright, expect

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url',required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--chrome',default='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
args=parser.parse_args()
assert urlparse(args.base_url).hostname in ('localhost','127.0.0.1')
args.output.mkdir(parents=True,exist_ok=True)
fixture=json.loads((Path(__file__).resolve().parents[1]/'src/lib/review-workspace/contracts/fixture.json').read_text())['view']
saved={};writes=[]
base_path=f"/cases/{fixture['case_id']}/reports/{fixture['report_id']}/review-evidence"
target=dict(deliveryRevisionId=fixture['selection']['delivery']['id'],implementationId=fixture['selection']['implementation']['id'],implementationRevision=str(fixture['selection']['implementation']['revision']))

def build(selection=None,state='context'):
    value=deepcopy(fixture);value.update(state=state,review_id=None,frozen_at=None,confirmation_fingerprint=None)
    if selection:value['selection']=deepcopy(selection)
    else:
        for a in value['selection']['actions']:
            for key in ('page_current_id','page_previous_id','gsc_id','ga4_id'):a[key]=None
    for a,s in zip(value['actions'],value['selection']['actions']):
        for key,field in [('page','page_current_id'),('gsc','gsc_id'),('ga4','ga4_id')]:
            if not s[field]:a[key]=None
    if state=='preview':value['confirmation_fingerprint']='sha256:'+'a'*64
    return value

def route(request_route):
    request=request_route.request;url=urlparse(request.url)
    if url.hostname not in ('127.0.0.1','localhost'):
        request_route.abort();return
    if '/api/v2/cases/' not in url.path or not url.path.endswith('/review-evidence'):
        request_route.continue_();return
    body=request.post_data_json if request.method=='POST' else {k:v[0] for k,v in parse_qs(url.query).items()}
    operation=body['operation']
    if operation=='context':value=build()
    elif operation=='preview':value=build(body['selection'],'preview')
    elif operation=='save':
        writes.append(body);value=build(body['selection'],'saved');value.update(review_id=body['review_id'],frozen_at=fixture['frozen_at']);saved[body['review_id']]=value
    elif operation=='read':value=saved[body['review_id']]
    elif operation in ('history','versions','candidates'):
        items=[];kind=body['kind']
        def item(id,revision=0):return dict(id=id,revision=revision,at=fixture['evaluated_at'],delivery_id=target['deliveryRevisionId'],delivery_revision=1)
        if operation=='candidates':items=[item(fixture['selection']['actions'][0][{'page':'page_current_id','gsc':'gsc_id','ga4':'ga4_id'}[kind]])]
        elif operation=='history':items=[item(id) for id in saved]
        elif kind=='deliveries':items=[item(target['deliveryRevisionId'],1)]
        else:items=[item(target['implementationId'],1)]
        value=dict(case_id=fixture['case_id'],report_id=fixture['report_id'],kind=kind,items=items,next_cursor=None)
    else:raise AssertionError(operation)
    request_route.fulfill(status=200,content_type='application/json',body=json.dumps(value),headers={'Cache-Control':'private, no-store'})

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=args.chrome,headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000},locale='en-US',timezone_id='UTC')
    context.route('**/*',route)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(args.base_url+base_path+'?'+urlencode(target));page.wait_for_load_state('networkidle')
    expect(page.get_by_label('Choose a saved page check')).to_be_visible(timeout=60000)
    print('Rendered controls:',page.get_by_role('button').all_text_contents()[-10:])
    page.screenshot(path=str(args.output/'workspace-desktop.png'),full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    for name,field in [('page check','page_current_id'),('Search Console comparison','gsc_id'),('Google Analytics collection','ga4_id')]:
        control=page.get_by_label('Choose a saved '+name);control.focus();expect(control).to_be_focused()
        control.select_option(fixture['selection']['actions'][0][field]);page.wait_for_load_state('networkidle')
    expect(page.get_by_role('table')).to_have_count(2)
    page.screenshot(path=str(args.output/'workspace-selected.png'),full_page=True)
    page.get_by_role('button',name='Review selection →').click()
    expect(page.get_by_role('heading',name='Check exactly what this review will keep.')).to_be_visible()
    save=page.get_by_role('button',name='Save evidence snapshot · Free');expect(save).to_be_disabled()
    page.get_by_role('checkbox').check();save.click()
    expect(page.get_by_role('heading',name='Evidence snapshot saved.')).to_be_visible()
    assert len(writes)==1
    expect(page.get_by_role('checkbox')).to_have_count(0)
    page.reload();page.wait_for_load_state('networkidle');expect(page.get_by_role('heading',name='Evidence snapshot saved.')).to_be_visible()
    page.screenshot(path=str(args.output/'workspace-saved.png'),full_page=True)
    page.get_by_role('button',name='Prepare another snapshot').click()
    expect(page.get_by_role('heading',name='Keep the versions explicit.')).to_be_visible()
    page.get_by_label('01 · Approved delivery').select_option(target['deliveryRevisionId'])
    page.get_by_role('button',name='Implementation revision 1',exact=False).click()
    expect(page.get_by_label('Choose a saved page check')).to_have_value('')
    page.set_viewport_size({'width':390,'height':844});page.wait_for_load_state('networkidle')
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    page.screenshot(path=str(args.output/'workspace-mobile.png'),full_page=True)
    page.get_by_role('button',name='Review selection →').click();page.get_by_role('checkbox').check();page.get_by_role('button',name='Save evidence snapshot · Free').click()
    expect(page.get_by_role('heading',name='Evidence snapshot saved.')).to_be_visible()
    assert len(writes)==2 and writes[0]['review_id']!=writes[1]['review_id']
    page.get_by_role('button',name='Saved snapshots',exact=True).click()
    expect(page.get_by_role('heading',name='Return to an exact review.')).to_be_visible()
    assert not errors,errors
    browser.close()
print('PASS: desktop/mobile selection, keyboard focus, bounded layout, confirmation guard, save/read refresh, new versions and history; no external requests.')
