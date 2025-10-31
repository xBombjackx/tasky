
from playwright.sync_api import sync_playwright

def verify_config_moderation():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto('http://localhost:8080/config.html?local=true')

        # Wait for the initial tasks to load
        page.wait_for_selector('#pending-tasks-container:has-text("Do a barrel roll!")')

        # Click the "Approve" button on the first task
        page.get_by_role("button", name="Approve").first.click()

        # Wait for the UI to update, then click "Reject" on the next task
        page.wait_for_selector('#pending-tasks-container:has-text("Name a character after me")')
        page.get_by_role("button", name="Reject").first.click()

        # Wait for the final state and take a screenshot
        page.wait_for_selector('#pending-tasks-container:has-text("Let me pick the next song")')
        page.screenshot(path='jules-scratch/verification/config_moderation_verification.png')

        browser.close()

if __name__ == '__main__':
    verify_config_moderation()
