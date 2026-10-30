/**
 * Set of articles, prepositions, and stop words to strip from the final output
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'that', 'there', 'what', 'who', 'where', 'why', 'when', 'how', 'is','and','or','not', 'it',
  'about', 'above', 'across', 'after', 'at', 'behind', 'below', 'beside', 
  'between', 'by', 'concerning', 'considering', 'despite', 'down', 'during', 
  'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 
  'out', 'over', 'past', 'to', 'toward', 'towards', 'under', 
  'until', 'up', 'upon', 'with', 'without'
]);

function jaroDistance(s1, s2) {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return ((matches / len1) + (matches / len2) + ((matches - (transpositions / 2)) / matches)) / 3.0;
}

function jaroWinkler(s1, s2, p = 0.1) {
  const jaroScore = jaroDistance(s1, s2);
  if (jaroScore < 0.7) return jaroScore;

  let prefixLength = 0;
  const maxPrefix = 4;

  for (let i = 0; i < Math.min(s1.length, s2.length, maxPrefix); i++) {
    if (s1[i] === s2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  return jaroScore + (prefixLength * p * (1 - jaroScore));
}

function getStem(word) {
  if (typeof stemmer === 'function') return stemmer(word);
  if (typeof PorterStemmer !== 'undefined' && typeof PorterStemmer.stem === 'function') return PorterStemmer.stem(word);
  if (typeof PorterStemmer1980 !== 'undefined' && typeof PorterStemmer1980.stem === 'function') return PorterStemmer1980.stem(word);
  return word;
}

/**
 * Query val.town proxy with a length parameter to fetch a batch of QRNG numbers at once
 */
async function fetchBatchModNumbers(count = 10) {
  try {
    const response = await fetch(`https://selapian--2f58e6388fb311f1b0781607ee4eb77e.web.val.run/?length=${count}`);
    const data = await response.json();
    
    // Assuming your Val.Town proxy returns an array of numbers when 'length' is provided,
    // or falls back to generating an array if it returns a single object.
    if (Array.isArray(data.numbers)) {
      return data.numbers;
    } else if (typeof data.number === 'number') {
      return [data.number];
    }
    
    // Fallback array of pseudo-random numbers if format differs
    return Array.from({ length: count }, () => Math.floor(Math.random() * 10000));
  } catch (err) {
    console.warn('Batch endpoint fetch failed, defaulting to random numbers:', err);
    return Array.from({ length: count }, () => Math.floor(Math.random() * 10000));
  }
}

/**
 * Returns an array of matching translation values whose score meets or exceeds the threshold
 */
function findAllMatches(word, stem, dictionary, threshold) {
  if (!dictionary) return [];

  const keys = Object.keys(dictionary);
  let matches = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let score = jaroWinkler(word, key);

    if (score < threshold && word.length > 4) {
      const stemScore = jaroWinkler(stem, key);
      score = Math.max(score, stemScore);
    }

    if (score >= threshold) {
      matches.push(dictionary[key]);
    }
  }

  return matches;
}

/**
 * Quantum selection algorithm: arr[QRNG % arr.length]
 */
/**
 * Quantum selection algorithm using a batch-fetched QRNG array: arr[QRNG % arr.length]
 */
async function quantumSelect(arr) {
  if (!arr || arr.length === 0) return null;
  
  // Fetch the batch of QRNG numbers
  const qrngBatch = await fetchBatchModNumbers(10);
  
  if (!qrngBatch || qrngBatch.length === 0) {
    // Fallback if batch fetch fails
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // Pick the first quantum number from the batch (or you can use Math.random() to pick an index from qrngBatch)
  const qrngValue = qrngBatch[0];
  
  const index = Math.abs(qrngValue) % arr.length;
  return arr[index];
}

document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scanBtn');
  const inputText = document.getElementById('inputText');
  const thresholdInput = document.getElementById('threshold');
  const resultsDiv = document.getElementById('results');

  scanBtn.addEventListener('click', async () => {
    const rawText = inputText.value;
    const threshold = parseFloat(thresholdInput.value) || 0.8;
    
    const dbModeRadio = document.querySelector('input[name="dbMode"]:checked');
    const selectedDbMode = dbModeRadio ? dbModeRadio.value : 'both';

    if (!rawText.trim()) {
      resultsDiv.innerHTML = '<em>Please enter text above.</em>';
      return;
    }

    const hasPIE = typeof PIE_DICTIONARY !== 'undefined';
    const hasLatin = typeof LATIN_DICTIONARY !== 'undefined';

    if (selectedDbMode === 'pie' && !hasPIE) {
      resultsDiv.innerHTML = '<strong style="color:red;">Error: PIE_DICTIONARY is not loaded.</strong>';
      return;
    }
    if (selectedDbMode === 'latin' && !hasLatin) {
      resultsDiv.innerHTML = '<strong style="color:red;">Error: LATIN_DICTIONARY is not loaded.</strong>';
      return;
    }
    if (selectedDbMode === 'both' && !hasPIE && !hasLatin) {
      resultsDiv.innerHTML = '<strong style="color:red;">Error: Neither PIE_DICTIONARY nor LATIN_DICTIONARY is loaded.</strong>';
      return;
    }

    const tokens = rawText.split(/(\s+|[^\w\s]+)/);

    const translatedTokens = await Promise.all(
      tokens.map(async (token) => {
        if (!token || /^\s+$/.test(token) || /^[^\w\s]+$/.test(token)) {
          return token;
        }

        const cleanWord = token.toLowerCase();

        if (STOP_WORDS.has(cleanWord)) {
          return '';
        }

        const stem = getStem(cleanWord);
        let candidateMatches = [];

        if (selectedDbMode === 'pie') {
          candidateMatches = findAllMatches(cleanWord, stem, PIE_DICTIONARY, threshold);
        } else if (selectedDbMode === 'latin') {
          candidateMatches = findAllMatches(cleanWord, stem, LATIN_DICTIONARY, threshold);
        } else if (selectedDbMode === 'both') {
          const pieMatches = hasPIE ? findAllMatches(cleanWord, stem, PIE_DICTIONARY, threshold) : [];
          const latinMatches = hasLatin ? findAllMatches(cleanWord, stem, LATIN_DICTIONARY, threshold) : [];
          candidateMatches = pieMatches.concat(latinMatches);
        }

        // If we found matching candidates, apply your quantum algorithm: arr[QRNG % arr.length]
        if (candidateMatches.length > 0) {
          const selectedTranslation = await quantumSelect(candidateMatches);
          if (selectedTranslation) {
            return selectedTranslation;
          }
        }

        return token;
      })
    );

    const translatedSentence = translatedTokens
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    resultsDiv.innerHTML = `<p style="font-size: 1.1rem; line-height: 1.6;">${translatedSentence}</p>`;
  });
});