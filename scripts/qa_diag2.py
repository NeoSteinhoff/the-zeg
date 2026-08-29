"""Capture real pageerror stacks (function name + line) for each view."""
from playwright.sync_api import sync_playwright
import time
APP = "http://127.0.0.1:8702/index.html"
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width":1400,"height":900})
    stacks = []
    page.on("pageerror", lambda e: stacks.append(str(e)))
    page.goto(APP, wait_until="networkidle", timeout=20000)
    page.wait_for_selector("#command-center", timeout=8000)
    time.sleep(1)
    views = ["command-center","circle-pipeline","mesh-crm","goals","timeline","soul-engine",
             "agent-storefront","ecosystem","hermes-control","aurora-brain","system-health",
             "agent-grid","mission-control","live-feed","tasks","cron-monitor","ventures","treasury","war-room"]
    for v in views:
        before = len(stacks)
        page.click(f'.nav-item[data-view="{v}"]')
        time.sleep(1.5)
        if len(stacks) > before:
            print(f"### {v}: {stacks[-1][:300]}")
    # also trigger refresh + circle live poll
    page.click('.nav-item[data-view="circle-pipeline"]'); time.sleep(7)
    page.click("#refresh-btn"); time.sleep(1)
    print("TOTAL errors:", len(stacks))
    for s in stacks[:20]:
        print("-", s[:200])
    browser.close()
