browser.commands.onCommand.addListener( function (command) {
  switch (command) {
    case 'switch-ratio':
      sendMessageToActiveTab({
        command: "switch-ratio"
      });
      break;
    case 'switch-ratio-reverse':
      sendMessageToActiveTab({
        command: "switch-ratio-reverse"
      });
      break;
  }
});

function sendMessageToActiveTab (message) {
  return browser.tabs.query({active: true, currentWindow: true})
  .then( function (tabs) {
    browser.tabs.sendMessage(tabs[0].id, message);
  })
  .catch(reportError);
}


function reportError (error) {
  console.error(`Error occured: ${error}`);
}