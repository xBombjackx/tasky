
from playwright.sync_api import sync_playwright

def verify_secure_dom():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('http://localhost:8080/config.html?local=true')

        # Wait for the initial tasks to load to ensure the DOM is populated
        page.wait_for_selector('#pending-tasks-container:has-text("Do a barrel roll!")')

        page.screenshot(path='jules-scratch/verification/secure_dom_verification.png')

        browser.close()

if __name__ == '__main__':
    verify_secure_dom()
