/*** CONSTANTS ***/
var ERROR_COLOR = '#ff8989';
var WHITE_COLOR = '#ffffff';
var ERROR_TEXT = "Content script was not loaded. Are you currently in the Chrome Web Store or in a chrome:// page? If you are, content scripts won't work here. If not, please wait for the page to finish loading or refresh the page.";
var SHOW_HISTORY_TITLE = "Show search menu";
var HIDE_HISTORY_TITLE = "Hide search menu";
var ENABLE_CASE_INSENSITIVE_TITLE = "Enable case insensitive search";
var DISABLE_CASE_INSENSITIVE_TITLE = "Disable case insensitive search";
var ENABLE_SYNONYM_SEARCH_TITLE = "Enable synonym search";
var DISABLE_SYNONYM_SEARCH_TITLE = "Disable synonym search";
var HISTORY_IS_EMPTY_TEXT = "Search menu is empty.";
var CLEAR_ALL_HISTORY_TEXT = "Clear Menu";
var DEFAULT_CASE_INSENSITIVE = false;
var DEFAULT_SEARCH_TYPE = "Default";
var DEFAULT_KEY = "";
/*** CONSTANTS ***/

/*** VARIABLES ***/
var sentInput = false;
var processingKey = false;
var searchMenu = null;
var configurationChanged = false;
/*** VARIABLES ***/

/*** FUNCTIONS ***/

/* Send message to content script of tab to select next result */
function selectNext(){
  chrome.tabs.query({
    'active': true,
    'currentWindow': true
  },
  function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'selectNextNode'
      });
    }
  });
}

/* Send message to content script of tab to select previous result */
function selectPrev(){
  chrome.tabs.query({
    'active': true,
    'currentWindow': true
  },
  function(tabs) {
    if ('undefined' != typeof tabs[0].id && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message' : 'selectPrevNode'
      });
    }
  });
}

/* Send message to pass input string to content script of tab to find and highlight regex matches */
// function passInputToContentScript(){
//   passInputToContentScript(false);
// }

function passInputToContentScript(){
  if (!processingKey) {
    var regexString = document.getElementById('inputText').value;
    document.getElementById('inputText').style.backgroundColor = WHITE_COLOR;
    chrome.tabs.query(
      { 'active': true, 'currentWindow': true },
      function(tabs) {
        if ('undefined' != typeof tabs[0].id && tabs[0].id) {
          processingKey = true;
          chrome.tabs.sendMessage(tabs[0].id, {
            'message' : 'search',
            'regexString' : regexString,
            'configurationChanged' : configurationChanged,
            'getNext' : true
          });
          sentInput = true;
          configurationChanged = false;
        }
      }
    );
  }
}

function setMenuVisibility(makeVisible) {
  toggleSearchType()
  document.getElementById('menu').style.display = makeVisible ? 'block' : 'none';
  document.getElementById('show-menu').className = makeVisible ? 'selected' : '';
}

function setCaseInsensitiveElement() {
  var caseInsensitive = chrome.storage.local.get({'caseInsensitive':DEFAULT_CASE_INSENSITIVE},
  function (result) {
    document.getElementById('insensitive').checked = result.caseInsensitive ? true : false;
  });
}

function toggleCaseInsensitive() {
  var caseInsensitive = document.getElementById('insensitive').checked;
  sentInput = false;
  configurationChanged = true;
  chrome.storage.local.set({caseInsensitive: caseInsensitive});
}

function setSearchType() {
  var selectedSearchType = chrome.storage.local.get({'selectedSearchType':DEFAULT_SEARCH_TYPE},
  function(result) {
    document.getElementById("search_type").value = result.selectedSearchType;
    const displayStyle = selectedSearchType === "Semantic Search" ? "block" : "none";
    document.getElementById('openAIKey').style.display = displayStyle;
    document.getElementById('keyLabel').style.display = displayStyle;
    document.getElementById('confirmKey').style.display = displayStyle;
  });
  setAIKey()
}

function toggleSearchType() {
  var selectedSearchType = document.getElementById("search_type").value;
  sentInput = false;
  configurationChanged = true;
  chrome.storage.local.set({selectedSearchType: selectedSearchType});
  const displayStyle = selectedSearchType === "Semantic Search" ? "block" : "none";
  document.getElementById('openAIKey').style.display = displayStyle;
  document.getElementById('keyLabel').style.display = displayStyle;
  document.getElementById('confirmKey').style.display = displayStyle;
  setAIKey()
}

function setAIKey() {
  var openAIKey = chrome.storage.local.get({'openAIKey':DEFAULT_KEY},
  function(result) {
    document.getElementById("openAIKey").value = result.openAIKey;
    const empty = result.openAIKey === DEFAULT_KEY;
    document.getElementById("openAIKey").readOnly = empty ? false : true;
    document.getElementById("openAIKey").style.backgroundColor = empty ? 'white' : 'lightgrey';
    document.getElementById('confirmKey').className = empty ? '' : 'selected';
  });
}

function toggleAIKey() {
  sentInput = false;
  configurationChanged = true;
  document.getElementById("openAIKey").readOnly = !document.getElementById("openAIKey").readOnly;
  var keySet = document.getElementById('confirmKey').className == 'selected';
  document.getElementById('confirmKey').className = keySet ? '' : 'selected';
  document.getElementById("openAIKey").style.backgroundColor = keySet ? 'white' : 'lightgrey';
  var openAIKey = document.getElementById("openAIKey").value;
  chrome.storage.local.set({openAIKey: openAIKey});
}


/*** LISTENERS ***/
document.getElementById('next').addEventListener('click', function() {
  selectNext();
});

document.getElementById('prev').addEventListener('click', function() {
  selectPrev();
});

document.getElementById('show-menu').addEventListener('click', function() {
  var makeVisible = document.getElementById('menu').style.display == 'none';
  setMenuVisibility(makeVisible);
});

document.getElementById('insensitive').addEventListener('click', function() {
  toggleCaseInsensitive();
});

document.getElementById("search_type").addEventListener("change", function() {
  toggleSearchType();
});

document.getElementById("confirmKey").addEventListener("click", function() {
  toggleAIKey()
});

/* Received returnSearchInfo message, populate popup UI */ 
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('returnSearchInfo' == request.message) {
    processingKey = false;
    if (request.numResults > 0) {
      document.getElementById('numResults').textContent = String(request.currentSelection+1) + ' of ' + String(request.numResults);
    } else {
      document.getElementById('numResults').textContent = String(request.currentSelection) + ' of ' + String(request.numResults);
    }
    if (!sentInput) {
      document.getElementById('inputText').value = request.regexString;
    }
    if (request.regexString !== document.getElementById('inputText').value) {
      passInputToContentScript();
    }
  }
});

/* Key listener for selectNext and selectPrev
 * Thanks a lot to Cristy from StackOverflow for this AWESOME solution
 * http://stackoverflow.com/questions/5203407/javascript-multiple-keys-pressed-at-once */
var map = [];
onkeydown = onkeyup = function(e) {
    map[e.keyCode] = e.type == 'keydown';
    if (document.getElementById('inputText') === document.activeElement) { //input element is in focus
      if (!map[16] && map[13]) { //ENTER
        if (sentInput) {
          selectNext();
        } else {
          console.log(8);
          passInputToContentScript();
        }
      } else if (map[16] && map[13]) { //SHIFT + ENTER
        selectPrev();
      }
    }
}
/*** LISTENERS ***/

/*** INIT ***/
/* Retrieve from storage whether we should use instant results or not */
chrome.storage.local.get({
    'isSearchMenuVisible' : false},
  function(result) {
    document.getElementById('inputText').addEventListener('change', function() {
      passInputToContentScript();
    });
    console.log(result);
  }
);

/* Get search info if there is any */
chrome.tabs.query({
  'active': true,
  'currentWindow': true
},
function(tabs) {
  if ('undefined' != typeof tabs[0].id && tabs[0].id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      'message' : 'getSearchInfo'
    }, function(response){
      if (response) {
        // Content script is active
        console.log(response);
      } else {
        console.log(response);
        document.getElementById('error').textContent = ERROR_TEXT;
      }
    });
  }
});

/* Focus onto input form */
document.getElementById('inputText').focus();
window.setTimeout( 
  function(){document.getElementById('inputText').select();}, 0);
//Thanks to http://stackoverflow.com/questions/480735#comment40578284_14573552

document.getElementById('menu').style.display = 'none';
setCaseInsensitiveElement();
setSearchType();
/*** INIT ***/