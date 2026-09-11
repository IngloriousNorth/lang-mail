/**
 * Set of articles, prepositions, and stop words to strip from the final output
 */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'that', 'there', 'what', 'who', 'where', 'why', 'when', 'how', 'is','and','or','not', 'it',
  'about', 'above', 'across', 'after', 'at', 'before', 'behind', 'below', 'beside', 
  'between', 'by', 'concerning', 'considering', 'despite', 'down', 'during', 'except', 
  'for', 'from', 'in', 'inside', 'into', 'like', 'near', 'of', 'off', 'on', 'onto', 
  'out', 'over', 'past', 'through', 'throughout', 'to', 'toward', 'towards', 'under', 
  'until', 'unto', 'up', 'upon', 'with', 'without'
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

function findBestMatch(word, stem, dictionary, threshold) {
  if (!dictionary) return { bestValue: null, highestScore: 0 };

  const keys = Object.keys(dictionary);
  let bestValue = null;
  let highestScore = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let score = jaroWinkler(word, key);

    if (score < threshold && word.length > 4) {
      const stemScore = jaroWinkler(stem, key);
      score = Math.max(score, stemScore);
    }

    if (score >= threshold && score > highestScore) {
      highestScore = score;
      bestValue = dictionary[key];
    }
  }

  return { bestValue, highestScore };
}

async function fetchModNumber() {
  try {
    const response = await fetch('https://selapian--2f58e6388fb311f1b0781607ee4eb77e.web.val.run/');
    const data = await response.json();
    return typeof data.number === 'number' ? data.number : Math.floor(Math.random() * 10000);
  } catch (err) {
    console.warn('Endpoint fetch failed, defaulting to random number:', err);
    return Math.floor(Math.random() * 10000);
  }
}

/**
 * pickle_surprise
 * Prepends a QRNG word to a translated token if Math.random() passes the threshold
 */
async function pickle_surprise(translatedToken, chance = 0.5) {
  if (!translatedToken || Math.random() > chance) {
    return translatedToken;
  }

  const wordList = typeof TOP_SHARED_ENGLISH_WORDS !== 'undefined' 
    ? TOP_SHARED_ENGLISH_WORDS 
    : (window.TOP_SHARED_ENGLISH_WORDS || []);

  if (wordList.length === 0) {
    console.warn('pickle_surprise: TOP_SHARED_ENGLISH_WORDS is empty or unavailable.');
    return translatedToken;
  }

  const num = await fetchModNumber();
  const qrngIndex = Math.abs(num) % wordList.length;
  const qrngWord = wordList[qrngIndex];

  return `${qrngWord} ${translatedToken}`;
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

    const outputModeRadio = document.querySelector('input[name="outputMode"]:checked');
    const selectedOutputMode = outputModeRadio ? outputModeRadio.value : 'translate';

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
        let matchedTranslation = null;

        if (selectedDbMode === 'pie') {
          const res = findBestMatch(cleanWord, stem, PIE_DICTIONARY, threshold);
          if (res.bestValue) matchedTranslation = res.bestValue;
        } else if (selectedDbMode === 'latin') {
          const res = findBestMatch(cleanWord, stem, LATIN_DICTIONARY, threshold);
          if (res.bestValue) matchedTranslation = res.bestValue;
        } else if (selectedDbMode === 'both') {
          const pieRes = hasPIE ? findBestMatch(cleanWord, stem, PIE_DICTIONARY, threshold) : { bestValue: null };
          const latinRes = hasLatin ? findBestMatch(cleanWord, stem, LATIN_DICTIONARY, threshold) : { bestValue: null };

          if (pieRes.bestValue && latinRes.bestValue) {
            const num = await fetchModNumber();
            const wordMod = Math.abs(num) % 2;
            matchedTranslation = wordMod === 1 ? pieRes.bestValue : latinRes.bestValue;
          } else if (pieRes.bestValue) {
            matchedTranslation = pieRes.bestValue;
          } else if (latinRes.bestValue) {
            matchedTranslation = latinRes.bestValue;
          }
        }

        // Apply QRNG only if 'qrng' mode is selected
        if (matchedTranslation) {
          if (selectedOutputMode === 'qrng') {
            return await pickle_surprise(matchedTranslation, 0.5);
          }
          return matchedTranslation;
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
  
