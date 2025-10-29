from playwright.sync_api import sync_playwright

def run(playwright):
    """
    Open a headless Chromium browser, navigate to the local code page, wait for streamer and viewer task labels, and save a screenshot.
    
    Parameters:
        playwright: A Playwright sync API instance (the object returned by sync_playwright()) used to launch the browser.
    
    Side effects:
        Saves a PNG screenshot to "jules-scratch/verification/verification.png".
    """
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    page.goto("http://localhost:8080/code.html?local=true")
    page.wait_for_selector("#streamer-tasks > label")
    page.wait_for_selector("#viewer-tasks > label")
    page.screenshot(path="jules-scratch/verification/verification.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)