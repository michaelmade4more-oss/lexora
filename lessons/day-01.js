/*
  Lexora Lesson Content — Day 1
  -----------------------------
  Matches the data shape defined in the Adult Learning Engine + 30-Day
  Curriculum Specification (v1.0), section 3.4 / 6.

  The five words, the quiz question frame, and the quiz sentence pairs
  already existed elsewhere in the app (Learn, Quiz) and are relocated
  here as-is — not new content. Fields marked "[PLACEHOLDER]" have
  never been authored anywhere in the product and are NOT approved
  curriculum. relatedWords is left empty rather than invented, since
  no related-word content has been written or approved yet.
  Replace every [PLACEHOLDER] field before this ships.
*/

var LEXORA_DAY_01 = {
  day: 1,
  theme: 'Communication',
  words: [
    {
      id: 'd1-w1',
      word: 'Relevant',
      pronunciation: '[PLACEHOLDER — pronunciation guide pending]',
      partOfSpeech: 'adjective',
      category: 'Communication',
      definition: 'Directly connected to the subject or situation being discussed.',
      professionalExample: 'The evidence is relevant to the decision.',
      conversationalExample: '[PLACEHOLDER — conversational example pending]',
      synonyms: ['[PLACEHOLDER]'],
      antonyms: ['[PLACEHOLDER]'],
      commonMistake: '[PLACEHOLDER — common mistake note pending]',
      useItWhen: 'Deciding whether information belongs in a discussion.',
      avoidItWhen: 'Relevant does not mean interesting.',
      relatedWords: [
        {
          slug: 'pertinent',
          word: 'pertinent',
          kind: 'Synonym',
          partOfSpeech: 'Adjective',
          meaning: 'Directly relevant to the matter being discussed.',
          professionalExample: 'Pertinent is useful when communicating with clarity and purpose.',
          conversationalExample: 'That is a pertinent way to approach the situation.',
          useItWhen: 'Deciding whether information belongs in a discussion.',
          whyHere: 'This word extends the vocabulary around your lesson word. Explore it to sharpen your range without leaving the lesson context.'
        }
      ],
      audioRef: null,
      quiz: {
        question: 'Which sentence uses "Relevant" correctly?',
        options: [
          'The evidence is relevant to the decision.',
          'The colour of his shoes was relevant to the budget meeting.'
        ],
        correctAnswer: 'The evidence is relevant to the decision.',
        explanation: '[PLACEHOLDER — answer explanation pending]'
      }
    },
    {
      id: 'd1-w2',
      word: 'Transparent',
      pronunciation: '[PLACEHOLDER — pronunciation guide pending]',
      partOfSpeech: 'adjective',
      category: 'Leadership',
      definition: '[PLACEHOLDER — definition pending curriculum approval]',
      professionalExample: 'She was transparent about the risks before we signed the contract.',
      conversationalExample: '[PLACEHOLDER — conversational example pending]',
      synonyms: ['[PLACEHOLDER]'],
      antonyms: ['[PLACEHOLDER]'],
      commonMistake: '[PLACEHOLDER — common mistake note pending]',
      useItWhen: '[PLACEHOLDER — usage guidance pending]',
      avoidItWhen: '[PLACEHOLDER — usage guidance pending]',
      relatedWords: [],
      audioRef: null,
      quiz: {
        question: 'Which sentence uses "Transparent" correctly?',
        options: [
          'She was transparent about the risks before we signed the contract.',
          'The bread was transparent after being left in the oven too long.'
        ],
        correctAnswer: 'She was transparent about the risks before we signed the contract.',
        explanation: '[PLACEHOLDER — answer explanation pending]'
      }
    },
    {
      id: 'd1-w3',
      word: 'Efficient',
      pronunciation: '[PLACEHOLDER — pronunciation guide pending]',
      partOfSpeech: 'adjective',
      category: 'Work',
      definition: '[PLACEHOLDER — definition pending curriculum approval]',
      professionalExample: 'The new process is efficient because it saves both time and money.',
      conversationalExample: '[PLACEHOLDER — conversational example pending]',
      synonyms: ['[PLACEHOLDER]'],
      antonyms: ['[PLACEHOLDER]'],
      commonMistake: '[PLACEHOLDER — common mistake note pending]',
      useItWhen: '[PLACEHOLDER — usage guidance pending]',
      avoidItWhen: '[PLACEHOLDER — usage guidance pending]',
      relatedWords: [],
      audioRef: null,
      quiz: {
        question: 'Which sentence uses "Efficient" correctly?',
        options: [
          'The new process is efficient because it saves both time and money.',
          'The music was efficient during the wedding ceremony.'
        ],
        correctAnswer: 'The new process is efficient because it saves both time and money.',
        explanation: '[PLACEHOLDER — answer explanation pending]'
      }
    },
    {
      id: 'd1-w4',
      word: 'Effective',
      pronunciation: '[PLACEHOLDER — pronunciation guide pending]',
      partOfSpeech: 'adjective',
      category: 'Results',
      definition: '[PLACEHOLDER — definition pending curriculum approval]',
      professionalExample: 'The strategy was effective because it achieved the target.',
      conversationalExample: '[PLACEHOLDER — conversational example pending]',
      synonyms: ['[PLACEHOLDER]'],
      antonyms: ['[PLACEHOLDER]'],
      commonMistake: '[PLACEHOLDER — common mistake note pending]',
      useItWhen: '[PLACEHOLDER — usage guidance pending]',
      avoidItWhen: '[PLACEHOLDER — usage guidance pending]',
      relatedWords: [],
      audioRef: null,
      quiz: {
        question: 'Which sentence uses "Effective" correctly?',
        options: [
          'The strategy was effective because it achieved the target.',
          'The strategy was effective because it used the most time.'
        ],
        correctAnswer: 'The strategy was effective because it achieved the target.',
        explanation: '[PLACEHOLDER — answer explanation pending]'
      }
    },
    {
      id: 'd1-w5',
      word: 'Credibility',
      pronunciation: '[PLACEHOLDER — pronunciation guide pending]',
      partOfSpeech: 'noun',
      category: 'Authority',
      definition: '[PLACEHOLDER — definition pending curriculum approval]',
      professionalExample: 'Her credibility grew after she delivered on every promise.',
      conversationalExample: '[PLACEHOLDER — conversational example pending]',
      synonyms: ['[PLACEHOLDER]'],
      antonyms: ['[PLACEHOLDER]'],
      commonMistake: '[PLACEHOLDER — common mistake note pending]',
      useItWhen: '[PLACEHOLDER — usage guidance pending]',
      avoidItWhen: '[PLACEHOLDER — usage guidance pending]',
      relatedWords: [],
      audioRef: null,
      quiz: {
        question: 'Which sentence uses "Credibility" correctly?',
        options: [
          'Her credibility grew after she delivered on every promise.',
          'The credibility of the room was painted a soft grey.'
        ],
        correctAnswer: 'Her credibility grew after she delivered on every promise.',
        explanation: '[PLACEHOLDER — answer explanation pending]'
      }
    }
  ]
};
