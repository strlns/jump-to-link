//if a bundler is introduced, move to shared module.
const MSG_TOGGLE = 0;
const MSG_NAVIGATION = 1;

/**
@todo
Something in here triggers a recursion error on the background page in Chrome and Firefox,
whenever the command is triggered,
but only on some pages (for example YouTube). 
The actual recursion in the content script (z index calculation and detection of fixed elements)
is not responsible. The background script keeps working.
*/

browser.commands.onCommand.addListener(async function(cmdName) {
    if (cmdName === 'toggle_jumptolink') {
        const tab = await getActiveTab();
        if (tab) {
            browser.tabs.sendMessage(
                tab.id,
                MSG_TOGGLE
            );
        }
    }
})

browser.webNavigation.onBeforeNavigate.addListener(async function() {
    const tab = await getActiveTab();
    if (tab) {
        browser.tabs.sendMessage(
            tab.id,
            MSG_NAVIGATION
        );
    }
});

async function getActiveTab() {
    return browser.tabs.query({
        active: true,
        currentWindow: true
    }).then(tabs => {
        if (tabs.length > 0) {
            return tabs[0];
        }
        else {
            return null;
        }
    })
}