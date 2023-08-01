async function similarMatchSearch(regexString) {
  require('@tensorflow/tfjs');
  const use = require('@tensorflow-models/universal-sentence-encoder');
  var chunks = ["The cat jumped over the fence.", "A storm is brewing in the distance.", "She opened the book and began to read.", "The sun set behind the mountains, casting a golden glow.", "The children played happily in the park, laughing and running around."]
  const model = await use.loadQnA();
  const input = {
    queries: [regexString],
    responses: chunks
  };
  const embeddings = model.embed(input);
  const embed_query = embeddings['queryEmbedding'].arraySync();
  const embed_responses = embeddings['responseEmbedding'].arraySync();
  const scores = [];
  for (let j = 0; j < chunks.length; j++) {
    scores.push({target: chunks[j], rating: dotProduct(embed_query[0], embed_responses[j])});
  }
  const sortedRatings = scores.sort((a, b) => b.rating - a.rating);
  var topTargets = sortedRatings.slice(0, 5).map(item => item.target);
  var regexList = [...new Set(topTargets)];
  regexList = regexList.map(str => new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  console.log(regexList);
}

// Calculate the dot product of two vector arrays.
function dotProduct(xs, ys) {
  const sum = xs => xs ? xs.reduce((a, b) => a + b, 0) : undefined;
  return xs.length === ys.length ?
    sum(zipWith((a, b) => a * b, xs, ys))
    : undefined;
}

// zipWith :: (a -> b -> c) -> [a] -> [b] -> [c]
function zipWith(f, xs, ys) {
  const ny = ys.length;
  return (xs.length <= ny ? xs : xs.slice(0, ny))
    .map((x, i) => f(x, ys[i]));
}

similarMatchSearch("jumped fence")