import time
"""Focused diagnostic: capture pageerror stacks + check top-bar button clickability."""
from playwright.sync_api import sync_playwright

APP = "http://127.0.0.1:8702/index.html"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width":1400,"height":900})
    stacks = []
    page.on("pageerror", lambda e: stacks.append(str(e) + "\n" + (e.stack or "")))
    page.goto(APP, wait_until="networkidle", timeout=20000)
    page.wait_for_selector("#command-center", timeout=8000)
    time.sleep(2)
    print("=== PAGEERROR STACKS (count=%d) ===" % len(stacks))
    for s in stacks[:8]:
        print("-"*60)
        print(s[:600])

    # Check top-bar button hit-testing (is something on top?)
    for sel in ["#theme-toggle","#fullscreen-btn","#refresh-btn","#larp-btn"]:
        box = page.eval_on_selector(sel, "e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}")
        top = page.evaluate("""(args)=>{const [x,y]=args; const el=document.elementFromPoint(x,y); return el? (el.id||el.className||el.tagName):'null';}""",
                             [box["x"]+box["w"]/2, box["y"]+box["h"]/2])
        print(f"{sel}: center=({box['x']:.0f},{box['y']:.0f}) elementFromPoint={top}")

    # Force-click larp via JS (bypass interception) to confirm handler works
    page.evaluate("document.getElementById('larp-btn').click()")
    time.sleep(0.5)
    print("JS-click larp-btn -> larp-mode =", page.eval_on_selector("body","e=>e.classList.contains('larp-mode')"))

    # Check theme-ribbon CSS
    ribbon = page.eval_on_selector("#theme-ribbon","e=>{const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return {pos:cs.position, z:cs.zIndex, top:r.top, left:r.left, w:r.width, h:r.height, pe:cs.pointerEvents}}")
    print("theme-ribbon:", ribbon)
    # top-bar css
    tb = page.eval_on_selector(".top-bar","e=>{const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return {pos:cs.position, z:cs.zIndex, top:r.top, h:r.height}}")
    print("top-bar:", tb)
    browser.close()
