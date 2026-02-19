#!/usr/bin/env node

/**
 * Modal Event Listener
 * Connects to Maestro WebSocket and listens for modal actions
 */

const WebSocket = require('ws');

const SESSION_ID = process.env.MAESTRO_SESSION_ID || 'sess_1771195371420_9ae62zoo5';
const API_URL = process.env.MAESTRO_SERVER_URL || 'http://localhost:3002';
const WS_URL = API_URL.replace(/^http/, 'ws');

// Correct answers for the quiz
const CORRECT_ANSWERS = {
  stateless: ['round-robin'],
  stateful: ['ip-hash', 'sticky-sessions'],
  uneven: ['weighted-round-robin', 'least-connections'],
  geographic: ['geolocation']
};

function gradeQuiz(userAnswers) {
  let correctCount = 0;
  let totalQuestions = 6;
  const feedback = {};

  for (const [category, algorithms] of Object.entries(userAnswers)) {
    const correctForCategory = CORRECT_ANSWERS[category] || [];
    feedback[category] = {
      userPlaced: algorithms,
      correctAnswer: correctForCategory,
      results: []
    };

    for (const algo of algorithms) {
      if (correctForCategory.includes(algo)) {
        feedback[category].results.push(`✅ ${algo} - CORRECT!`);
        correctCount++;
      } else {
        feedback[category].results.push(`❌ ${algo} - INCORRECT`);
      }
    }

    // Check for missing algorithms that should be in this category
    for (const correctAlgo of correctForCategory) {
      if (!algorithms.includes(correctAlgo)) {
        feedback[category].results.push(`❓ Missing: ${correctAlgo}`);
      }
    }
  }

  const percentage = Math.round((correctCount / totalQuestions) * 100);
  let grade, comment;

  if (percentage >= 90) {
    grade = 'A+';
    comment = 'Excellent! You have a strong understanding of load balancing algorithms!';
  } else if (percentage >= 80) {
    grade = 'A';
    comment = 'Great job! You know your load balancers well!';
  } else if (percentage >= 70) {
    grade = 'B';
    comment = 'Good work! You have a solid foundation, but review a few concepts.';
  } else if (percentage >= 60) {
    grade = 'C';
    comment = 'Fair understanding. Consider reviewing load balancing strategies.';
  } else {
    grade = 'D';
    comment = 'Needs improvement. Take time to study different load balancing algorithms.';
  }

  return {
    score: `${correctCount}/${totalQuestions}`,
    percentage,
    grade,
    comment,
    feedback
  };
}

function displayResults(results) {
  const categoryNames = {
    stateless: '📊 Best for Stateless Applications',
    stateful: '🔗 Best for Stateful/Session-based Apps',
    uneven: '⚖️  Best for Servers with Uneven Capacity',
    geographic: '🌍 Best for Geographic Distribution'
  };

  for (const [category, data] of Object.entries(results.feedback)) {
    void categoryNames[category];
    void data;
  }
}

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  // Subscribe to this session's events
  ws.send(JSON.stringify({
    type: 'subscribe',
    sessionIds: [SESSION_ID]
  }));
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    const event = message.event || message.type;

    // Log connection events
    if (event === 'subscribed') {
      return;
    }

    // Check for modal action events
    if (event === 'session:modal_action') {
      const { modalId, action, data: actionData } = message.data;

      if (action === 'submit_answer') {
        const results = gradeQuiz(actionData);
        displayResults(results);

        // Exit after displaying results
        ws.close();
        process.exit(0);
      }
    }

    // Check for modal closed
    if (event === 'session:modal_closed') {
      ws.close();
      process.exit(0);
    }
  } catch (err) {
    void err;
  }
});

ws.on('error', (err) => {
  void err;
  process.exit(1);
});

ws.on('close', () => {
});

// Keep the process alive
process.on('SIGINT', () => {
  ws.close();
  process.exit(0);
});
