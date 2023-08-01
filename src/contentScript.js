/*** CONSTANTS ***/
var ELEMENT_NODE_TYPE = 1;
var TEXT_NODE_TYPE = 3;
var UNEXPANDABLE = /(script|style|svg|audio|canvas|figure|video|select|input|textarea)/i;
var HIGHLIGHT_TAG = 'highlight-tag';
var HIGHLIGHT_CLASS = 'highlighted';
var SELECTED_CLASS = 'selected';
var DEFAULT_MAX_RESULTS = 500;
var DEFAULT_HIGHLIGHT_COLOR = '#ffff00';
var DEFAULT_SELECTED_COLOR = '#2547da';
var DEFAULT_TEXT_COLOR = '#000000';
var DEFAULT_CASE_INSENSITIVE = false;
var DEFAULT_SEARCH_TYPE = "Default";
var DEFAULT_KEY = "";
// const KNN = require('ml-knn').default;
/*** CONSTANTS ***/

/*** VARIABLES ***/
var searchInfo;
var searching = false;
/*** VARIABLES ***/
                     
/*** LIBRARY FUNCTIONS ***/
Element.prototype.documentOffsetTop = function () {
  return this.offsetTop + ( this.offsetParent ? this.offsetParent.documentOffsetTop() : 0 );
};
Element.prototype.visible = function() {
    return (!window.getComputedStyle(this) || window.getComputedStyle(this).getPropertyValue('display') == '' || 
           window.getComputedStyle(this).getPropertyValue('display') != 'none')
}
/*** LIBRARY FUNCTIONS ***/


/*** FUNCTIONS ***/
/* Initialize search information for this tab */
function initSearchInfo(pattern) {
  var pattern = typeof pattern !== 'undefined' ? pattern : '';
  searchInfo = {
    regexString : pattern,
    selectedIndex : 0,
    highlightedNodes : [],
    length : 0,
  }
}

/* Send message with search information for this tab */
function returnSearchInfo(cause) {
  chrome.runtime.sendMessage({
    'message' : 'returnSearchInfo',
    'regexString' : searchInfo.regexString,
    'currentSelection' : searchInfo.selectedIndex,
    'numResults' : searchInfo.length,
    'cause' : cause,
  });
}

/* Check if the given node is a text node */
function isTextNode(node) {
  return node && node.nodeType === TEXT_NODE_TYPE;
}

/* Check if the given node is an expandable node that will yield text nodes */
function isExpandable(node) {
  return node && node.nodeType === ELEMENT_NODE_TYPE && node.childNodes && 
         !UNEXPANDABLE.test(node.tagName) && node.visible();
}

/* Highlight all text that matches regex */
function highlight(regex, highlightColor, selectedColor, textColor, maxResults) {
  function highlightRecursive(node) {
    if(searchInfo.length >= maxResults){
      return;
    }
    if (isTextNode(node)) {
      var index = node.data.search(regex);
      if (index >= 0 && node.data.length > 0) {
        var matchedText = node.data.match(regex)[0];
        var matchedTextNode = node.splitText(index);
        matchedTextNode.splitText(matchedText.length);
        var spanNode = document.createElement(HIGHLIGHT_TAG); 
        spanNode.className = HIGHLIGHT_CLASS;
        spanNode.style.backgroundColor = highlightColor;
        spanNode.style.color = textColor;
        spanNode.appendChild(matchedTextNode.cloneNode(true));
        matchedTextNode.parentNode.replaceChild(spanNode, matchedTextNode);
        searchInfo.highlightedNodes.push(spanNode);
        searchInfo.length += 1;
        return 1;
      }
    } else if (isExpandable(node)) {
        var children = node.childNodes;
        for (var i = 0; i < children.length; ++i) {
          var child = children[i];
          i += highlightRecursive(child);
        }
    }
    return 0;
  }
  highlightRecursive(document.getElementsByTagName('body')[0]);
  searchInfo.highlightedNodes.sort((nodeA, nodeB) => {
    const rectA = nodeA.getBoundingClientRect();
    const rectB = nodeB.getBoundingClientRect();
    return rectA.top - rectB.top;
  });
};

/* Remove all highlights from page */
function removeHighlight() {
  while (node = document.body.querySelector(HIGHLIGHT_TAG + '.' + HIGHLIGHT_CLASS)) {
    node.outerHTML = node.innerHTML;
  }
    while (node = document.body.querySelector(HIGHLIGHT_TAG + '.' + SELECTED_CLASS)) {
    node.outerHTML = node.innerHTML;
  }
};

/* Scroll page to given element */
function scrollToElement(element) {
    element.scrollIntoView(); 
    var top = element.documentOffsetTop() - ( window.innerHeight / 2 );
    window.scrollTo( 0, Math.max(top, window.pageYOffset - (window.innerHeight/2)));
}

/* Select first regex match on page */
function selectFirstNode(selectedColor) {
  var length =  searchInfo.length;
  if(length > 0) {
    searchInfo.highlightedNodes[0].className = SELECTED_CLASS;
    searchInfo.highlightedNodes[0].style.backgroundColor = selectedColor;
    parentNode = searchInfo.highlightedNodes[0].parentNode;
    if (parentNode.nodeType === 1) {
      parentNode.focus();
    } else if (parentNode.parentNode.nodeType == 1) {
      parentNode.parentNode.focus();
    }
    scrollToElement(searchInfo.highlightedNodes[0]);
  }
}

/* Helper for selecting a regex matched element */
function selectNode(highlightedColor, selectedColor, getNext) {
  var length = searchInfo.length;
  if(length > 0) {
    searchInfo.highlightedNodes[searchInfo.selectedIndex].className = HIGHLIGHT_CLASS;
    searchInfo.highlightedNodes[searchInfo.selectedIndex].style.backgroundColor = highlightedColor;
    console.log(searchInfo.highlightedNodes[searchInfo.selectedIndex].textContent)
      if(getNext) {
        if(searchInfo.selectedIndex === length - 1) {
          searchInfo.selectedIndex = 0; 
        } else {
          searchInfo.selectedIndex += 1;
        }
      } else {
        if(searchInfo.selectedIndex === 0) {
          searchInfo.selectedIndex = length - 1; 
        } else {
          searchInfo.selectedIndex -= 1;
        }
      }
    searchInfo.highlightedNodes[searchInfo.selectedIndex].className = SELECTED_CLASS;
    searchInfo.highlightedNodes[searchInfo.selectedIndex].style.backgroundColor = selectedColor;
    parentNode = searchInfo.highlightedNodes[searchInfo.selectedIndex].parentNode;
    if (parentNode.nodeType === 1) {
      parentNode.focus();
    } else if (parentNode.parentNode.nodeType == 1) {
      parentNode.parentNode.focus();
    }
    returnSearchInfo('selectNode');
    scrollToElement(searchInfo.highlightedNodes[searchInfo.selectedIndex]);
  }
}
/* Forward cycle through regex matched elements */
function selectNextNode(highlightedColor, selectedColor) {
  window.requestAnimationFrame(function() {
    selectNode(highlightedColor, selectedColor, true);
  }); 
}

/* Backward cycle through regex matched elements */
function selectPrevNode(highlightedColor, selectedColor) {
  window.requestAnimationFrame(function() {
    selectNode(highlightedColor, selectedColor, false);
  }); 
}

/* Validate that a given pattern string is a valid regex */
function validateRegex(pattern) {
  try{
    var regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return regex;
  } catch(e) {
    return false;
  }
}

/* Find and highlight regex matches in web page from a given regex string or pattern */
function search(regexString, configurationChanged) {
  chrome.storage.local.get({
    'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
    'selectedColor' : DEFAULT_SELECTED_COLOR,
    'textColor' : DEFAULT_TEXT_COLOR,
    'maxResults' : DEFAULT_MAX_RESULTS,
    'caseInsensitive' : DEFAULT_CASE_INSENSITIVE,
    'selectedSearchType': DEFAULT_SEARCH_TYPE,
    "openAIKey" : DEFAULT_KEY},
    function(result) {
      var regex = validateRegex(regexString);
      if (!searching && regex && regexString != '' && (configurationChanged || regexString !== searchInfo.regexString)){ // new valid regex string
        searching = true;
        removeHighlight();
        initSearchInfo(regexString);
        switch (result.selectedSearchType){
          case "Regex":
            regexSearch(regexString, result);
            break;
          case "Synonym":
            synonymSearch(regexString, result);
            break;
          case "Antonym":
            antonymSearch(regexString, result);
            break;
          case "Similar Match":
            similarMatchSearch(regexString, result);
            break;
          case "Semantic Search":
            semanticSearch(regexString, result);
            break;
          default:
            defaultSearch(regexString, result);
        }
      } else if (regexString == ''){ // blank string or invalid regex
        removeHighlight();
        initSearchInfo(regexString);
        returnSearchInfo('search');
      }
    }
  );
}

function defaultSearch(regexString, result) {
  if(result.caseInsensitive){
    regex = new RegExp(regexString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  } else{
    regex = new RegExp(regexString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }
  highlight(regex, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
  selectFirstNode(result.selectedColor);
  returnSearchInfo('search');
  searching = false;
}

function regexSearch(regexString, result) {
  if(result.caseInsensitive){
    regex = new RegExp(regexString, 'i');
  } else{
    regex = new RegExp(regexString);
  }
  highlight(regex, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
  selectFirstNode(result.selectedColor);
  returnSearchInfo('search');
  searching = false;
}

async function synonymSearch(regexString, result) {
  const url = new URL("https://api.api-ninjas.com/v1/thesaurus"); 
  url.searchParams.set("word", regexString);
  const response = await fetch(url, { headers: { "X-API-Key": "/cUeYXJRNyCaMH7FDK5G9w==Xh7I4HJRi9GstE91" } });
  const data = await response.json();
  var regexList = [regexString].concat(data.synonyms.filter(item => !item.includes(regexString)));
  regexList = regexList.filter(element =>  element !== undefined);
  regexList = [...new Set(regexList)];
  if(result.caseInsensitive){
    regexList = regexList.map(str => new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  } else{
    regexList = regexList.map(str => new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const reg of regexList){
    highlight(reg, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
  }
  selectFirstNode(result.selectedColor);
  returnSearchInfo('search');
  searching = false;
}

async function antonymSearch(regexString, result) {
  const url = new URL("https://api.api-ninjas.com/v1/thesaurus"); 
  url.searchParams.set("word", regexString);
  const response = await fetch(url, { headers: { "X-API-Key": "/cUeYXJRNyCaMH7FDK5G9w==Xh7I4HJRi9GstE91" } });
  const data = await response.json();
  var regexList = data.antonyms;
  regexList = regexList.filter(element =>  element !== undefined);
  regexList = [...new Set(regexList)];
  if(result.caseInsensitive){
    regexList = regexList.map(str => new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  } else{
    regexList = regexList.map(str => new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  for (const reg of regexList){
    highlight(reg, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
  }
  selectFirstNode(result.selectedColor);
  returnSearchInfo('search');
  searching = false;
}


// async function similarMatchSearch(regexString, result) {
//   const stringSimilarity = require("string-similarity");
//   const { removeStopwords } = require('stopword');
//   require('@tensorflow/tfjs');
//   const use = require('@tensorflow-models/universal-sentence-encoder');
//   const text = getTextContent();
//   const strWords = regexString.toString().split(" ")
//   const buffer = Math.max(Math.ceil(strWords.length*0.6), 2)
//   var chunks = []
//   for (let i = 0; i < text.length; i++) {
//     if (text[i].length <= 0) {
//       continue;
//     }
//     else if (text[i].split(" ").length < strWords.length + buffer) {
//       chunks.push(text[i]);
//       console.log(text[i]);
//     }
//     else {
//       var currScores = []
//       var newChunk = text[i].split(" ")
//       for (let s = 0; s < removeStopwords(strWords).length; s++) {
//         currScores.push([]);
//       }
//       for (let s = 0; s < newChunk.length; s++) {
//         var results = stringSimilarity.findBestMatch(newChunk[s], removeStopwords(strWords));
//         for (let n = 0; n < results.ratings.length; n++) {
//           currScores[n].push(results.ratings[n]);
//         }
//       }
//       const modifiedArray = getIndices(currScores)
//       const newChunks = textToChunks(text[i], strWords.length + buffer, modifiedArray)
//       chunks = chunks.concat(newChunks);
//       console.log(newChunks);
//     }
//   }
//   const model = await use.loadQnA();
//   const input = {
//     queries: [regexString],
//     responses: chunks
//   };
//   const embeddings = model.embed(input);
//   const embed_query = embeddings['queryEmbedding'].arraySync();
//   const embed_responses = embeddings['responseEmbedding'].arraySync();
//   const scores = [];
//   for (let j = 0; j < chunks.length; j++) {
//     scores.push({target: chunks[j], rating: dotProduct(embed_query[0], embed_responses[j])});
//   }
//   const sortedRatings = scores.sort((a, b) => b.rating - a.rating);
//   var topTargets = sortedRatings.slice(0, 5).map(item => item.target);
//   var regexList = [...new Set(topTargets)];
//   regexList = regexList.map(str => new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
//   console.log(regexList);
//   for (const reg of regexList){
//     highlight(reg, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
//   }
//   selectFirstNode(result.selectedColor);
//   returnSearchInfo('search');
//   searching = false;
// }

// // Calculate the dot product of two vector arrays.
// function dotProduct(xs, ys) {
//   const sum = xs => xs ? xs.reduce((a, b) => a + b, 0) : undefined;
//   return xs.length === ys.length ?
//     sum(zipWith((a, b) => a * b, xs, ys))
//     : undefined;
// }

// // zipWith :: (a -> b -> c) -> [a] -> [b] -> [c]
// function zipWith(f, xs, ys) {
//   const ny = ys.length;
//   return (xs.length <= ny ? xs : xs.slice(0, ny))
//     .map((x, i) => f(x, ys[i]));
// }

async function similarMatchSearch(regexString, result) {
  const stringSimilarity = require("string-similarity");
  const { removeStopwords } = require('stopword');
  const text = getTextContent();
  const strWords = regexString.toString().split(" ")
  const buffer = Math.max(Math.ceil(strWords.length/2), 2)
  var chunks = []
  for (let i = 0; i < text.length; i++) {
    if (text[i].length <= 0) {
      continue;
    }
    else if (text[i].split(" ").length < strWords.length + buffer) {
      chunks.push(text[i]);
      console.log(text[i]);
    }
    else {
      var currScores = []
      var newChunk = text[i].split(" ")
      for (let s = 0; s < removeStopwords(strWords).length; s++) {
        currScores.push([]);
      }
      for (let s = 0; s < newChunk.length; s++) {
        var results = stringSimilarity.findBestMatch(newChunk[s], removeStopwords(strWords));
        for (let n = 0; n < results.ratings.length; n++) {
          currScores[n].push(results.ratings[n]);
        }
      }
      const modifiedArray = getIndices(currScores)
      const newChunks = textToChunks(text[i], strWords.length + buffer, modifiedArray)
      chunks = chunks.concat(newChunks);
      console.log(newChunks);
    }
  }
  var scores = []
  const matches = stringSimilarity.findBestMatch(regexString.toString(), chunks);
  scores = scores.concat(matches.ratings)
  const sortedRatings = scores.sort((a, b) => b.rating - a.rating);
  var topTargets = sortedRatings.slice(0, 5).map(item => item.target);
  var regexList = [...new Set(topTargets)];
  regexList = regexList.map(str => new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  console.log(regexList);
  for (const reg of regexList){
    highlight(reg, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
  }
  selectFirstNode(result.selectedColor);
  returnSearchInfo('search');
  searching = false;
}

async function semanticSearch(regexString, result) {
  try{
    var messages = [];
    var texts = getTextContent();
    var textDict = {};
    for (let i=0; i<texts.length; i++){
      textDict[i] = texts[i];
    }
    messages.push({role: "system", content: "You will function as a Json api. You will be given a query and a dictionary of texts. Return the key and the value of the text in the dictionary that is best match for this query, whether it answers a question, gives an intended result, or is similar to the query. Make sure this key is linked to the best corresponding value. Do not return more than one key or value. Only the result should be in the output, do not include any explanation.\n\nexport Output = {key: number; value: string}"});
    messages.push({role: "user", content: "Query: " + regexString + "\n\nText: " + JSON.stringify(textDict)});
    console.log(messages);
    const apiKey = result.openAIKey;
    let response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
          "model": "gpt-3.5-turbo",
          "messages": messages,
          "temperature": 0
      })
    });
    let data = await response.json();
    var output = JSON.parse(data.choices[0].message.content);
    console.log(output);
    var index = Object.values(output)[0];
    var match = textDict[index];
    var regex = new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    highlight(regex, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
    selectFirstNode(result.selectedColor);
    returnSearchInfo('search');
    searching = false;
  }
  catch (error) {
    console.log("An error occurred:", error.message);
    throw error;
  }
}

function getIndices(lists) {
  var combinedList = []
  for (let s = 0; s < lists.length; s++) {
    const indexedArray = lists[s].map((value, index) => ({ value, index }));
    combinedList = combinedList.concat(indexedArray)
  }
  combinedList.sort((a, b) => b.value - a.value);
  const uniqueIndicesMap = new Map();
  combinedList.forEach(({ value, index }) => {
    if (!uniqueIndicesMap.has(index) || value > uniqueIndicesMap.get(index)) {
      uniqueIndicesMap.set(index, value);
    }
  });
  const modifiedArray = Array.from(uniqueIndicesMap, ([index, value]) => ({ index, value }));
  return modifiedArray
}

function getTextContent() {
  function getTextRecursive(node) {
    var text = [];
    if (isTextNode(node)) {
      var result = node.textContent.split(/[\n\t.]/);
      result.forEach(function(chunk) {
        var newStr = chunk.replace(/\s/g, "").replace(/\r?\n|\r/g, "").replace(/\t/g, "").replace(/\./g, "");
        if (newStr !== "") {
          text.push(chunk.trim());
        }
      });
    } else if (isExpandable(node)) {
      var children = node.childNodes;
      for (var i = 0; i < children.length; ++i) {
        var child = children[i];
        text = text.concat(getTextRecursive(child));
      }
    }
    return text;
  }
  return getTextRecursive(document.getElementsByTagName('body')[0]);
}

function textToChunks(text, maxLength, indexedArray) {
  const words = text.split(' ');
  const chunks = [];
  let numChunks = Math.ceil(words.length / maxLength);
  let chunkLength = Math.ceil(words.length / numChunks);
  var carry = [];
  console.log(text)
  for (let i = 0; i < words.length;) {
    if (i === 0) {
      let chunk = words.slice(i, i + Math.floor(chunkLength/2));
      carry = chunk;
      i += Math.floor(chunkLength/2);
    }
    else if (i + chunkLength >= words.length) {
      let chunk = words.slice(i, i + Math.ceil(chunkLength/2));
      chunk = carry.concat(chunk).join(' ');
      chunks.push(chunk);
      i += Math.ceil(chunkLength/2);
    }
    else {
      let chunk = words.slice(i, i + chunkLength);
      let highestIndex = null;
      let maxValue = -Infinity;
      for (const { index, value } of indexedArray) {
        if (chunk.includes(words[index]) && value > maxValue) {
          highestIndex = index;
          maxValue = value;
        }
      }
      if (highestIndex == i + chunkLength) {
        var newChunk = words.slice(i, i + highestIndex);
      }
      else{
        var newChunk = words.slice(i, i + highestIndex + 1);
      }
      newChunk = carry.concat(newChunk).join(' ');
      carry = chunk.slice(highestIndex);
      chunks.push(newChunk);
      i += chunkLength
    }
  }
  return chunks;
}


// function textToChunks(texts, maxLength, indices) {
//   const textToks = texts.map(t => t.split(' '));
//   const chunks = [];
//   for (let idx = 0; idx < textToks.length; idx++) {
//     const words = textToks[idx];
//     let numChunks = Math.ceil(words.length / maxLength);
//     let chunkLength = Math.ceil(words.length / numChunks);
//     for (let i = 0; i < words.length; i += chunkLength) {
//       let chunk = words.slice(i, i + chunkLength);
//       chunk = chunk.join(' ').trim();
//       chunks.push(chunk);
//     }
//   }
//   return chunks;
// }

/*
async function embeddingsSearch(regexString, result) {
  if (knn === null) {
    const textContent = await getTextContent();
    const chunks = await textToChunks(textContent);
    const embeddings = await getTextEmbeddings(chunks);
    embed = chunks;
    await fit(embeddings);
  }
  const qChunks = await textToChunks(regexString);
  const qEmbeddings = await getTextEmbeddings(qChunks);
  var ans = knn.predict(qEmbeddings);
  console.log(embed);
  for (let i = 0; i < embed.length; i++) {
    console.log(embed[i]);
  }
  for (let i = 0; i < ans.length; i++) {
    var output = embed[ans[i]];
    var regex = new RegExp(output, 'i');
    highlight(regex, result.highlightColor, result.selectedColor, result.textColor, result.maxResults);
  }
  selectFirstNode(result.selectedColor);
  returnSearchInfo('search');
  searching = false;
}

async function getTextEmbeddings(chunks, batch = 1000) {
  const use = require('@tensorflow-models/universal-sentence-encoder');
  const tf = require('@tensorflow/tfjs');
  const encoder = await use.load();
  const embeddings = [];
  for (let i = 0; i < chunks.length; i += batch) {
    const textBatch = chunks.slice(i, i + batch);
    const embBatch = await encoder.embed(textBatch);
    embeddings.push(embBatch);
  }
  const embeddingsArray = await Promise.all(embeddings);
  const concatenatedEmbeddings = tf.concat(embeddingsArray);
  const embeddingsData = await concatenatedEmbeddings.array();
  return embeddingsData;
}

async function fit(embeddings) {
  var indices = [];
  for (let i = 0; i < embeddings.length; i++) {
    indices.push(i);
  }
  knn = new KNN(embeddings, indices, {k: 3});
}
*/


/*** FUNCTIONS ***/

/*** LISTENERS ***/
/* Received search message, find regex matches */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if ('search' == request.message) {
    search(request.regexString, request.configurationChanged);
  }
  /* Received selectNextNode message, select next regex match */
  else if ('selectNextNode' == request.message) {
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR
      }, 
      function(result) {
        selectNextNode(result.highlightColor, result.selectedColor);
      }
    );
  }
  /* Received selectPrevNode message, select previous regex match */
  else if ('selectPrevNode' == request.message) {
    chrome.storage.local.get({
      'highlightColor' : DEFAULT_HIGHLIGHT_COLOR,
      'selectedColor' : DEFAULT_SELECTED_COLOR
      }, 
      function(result) {
        selectPrevNode(result.highlightColor, result.selectedColor);
      }
    );
  }
  /* Received getSearchInfo message, return search information for this tab */
  else if ('getSearchInfo' == request.message) {
    sendResponse({message: "I'm alive!"});
    returnSearchInfo('getSearchInfo');
  }
});
/*** LISTENERS ***/


/*** INIT ***/
initSearchInfo();
/*** INIT ***/