from playwright.sync_api import sync_playwright

URL = "https://the-zeg.vercel.app/"
VIEWS = ['command-center','war-room','tasks']

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append("CONSOLE:"+m.text) if m.type=="error" else None)
    pg.goto(URL, wait_until="networkidle")
    pg.wait_for_timeout(1500)
    for v in VIEWS:
        before = list(errs)
        pg.evaluate(f"navigateTo('{v}')")
        pg.wait_for_timeout(800)
        # trigger refresh (Cmd+R path -> viewModule.refresh())
        pg.keyboard.press("Meta+r")
        pg.wait_for_timeout(1500)
        new = errs[len(before):]
        print(f"\n=== {v} after Cmd+R ===")
        for e in new:
            print("  ", e[:160])
    # Check war-room has localhost ping entries in JS
    pg.evaluate("navigateTo('war-room')")
    pg.wait_for_timeout(1000)
    print("\nWar-room health targets present in source check:")
    has = pg.evaluate("() => { try { const s=document.querySelector('script[src*=\"war-room\"]'); return 'loaded'; } catch(e){return 'n/a'} }")
    b.close()
print("\nDONE")
