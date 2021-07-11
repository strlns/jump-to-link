//if a bundler is introduced, move to shared module.
const MSG_TOGGLE = 0;

browser.commands.onCommand.addListener(async function(cmdName) {
    if (cmdName === 'toggle_jumptolink') {
        try {
            const tab = await getActiveTab();
                browser.tabs.sendMessage(
                tab.id,
                MSG_TOGGLE
            );
        }
        catch {

        }  
    }
})

async function getActiveTab() {
    return browser.tabs.query({
        active: true,
        currentWindow: true
    }).then(tabs => {
        if (tabs.length > 0) {
            return tabs[0];
        }
        else {
            throw new Error('No active tab.');
        }
    })
}
// setInterval(() => {
    
// }, 500)