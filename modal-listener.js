#!/usr/bin/env node

/**
 * Modal Event Listener
 * Connects to Maestro WebSocket and listens for modal actions
 */

const WebSocket = require('ws');

const SESSION_ID = process.env.MAESTRO_SESSION_ID || 'sess_1771195371420_9ae62zoo5';
const API_URL = process.env.MAESTRO_SERVER_URL || 'http://localhost:3002';
const WS_URL = API_URL.replace(/^http/, 'ws');

console.log(`\n🎯 Modal Listener Starting...`);
console.log(`   Session ID: ${SESSION_ID}`);
console.log(`   WebSocket: ${WS_URL}\n`);

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
  console.log('\n' + '='.repeat(70));
  console.log('📊 LOAD BALANCER QUIZ RESULTS');
  console.log('='.repeat(70));
  console.log(`\nScore: ${results.score} (${results.percentage}%)`);
  console.log(`Grade: ${results.grade}`);
  console.log(`\n${results.comment}\n`);

  console.log('Detailed Feedback:');
  console.log('-'.repeat(70));

  const categoryNames = {
    stateless: '📊 Best for Stateless Applications',
    stateful: '🔗 Best for Stateful/Session-based Apps',
    uneven: '⚖️  Best for Servers with Uneven Capacity',
    geographic: '🌍 Best for Geographic Distribution'
  };

  for (const [category, data] of Object.entries(results.feedback)) {
    console.log(`\n${categoryNames[category]}`);
    console.log(`  Your answers: ${data.userPlaced.join(', ') || '(none)'}`);
    console.log(`  Correct: ${data.correctAnswer.join(', ')}`);
    data.results.forEach(result => console.log(`  ${result}`));
  }

  console.log('\n' + '='.repeat(70));
  console.log('\nKey Concepts:');
  console.log('• Round Robin: Simple, stateless, distributes evenly');
  console.log('• Least Connections: Adapts to server load, good for varying capacity');
  console.log('• IP Hash: Routes same client to same server (stateful)');
  console.log('• Weighted Round Robin: Distributes based on server capacity');
  console.log('• Geolocation: Routes based on geographic proximity');
  console.log('• Sticky Sessions: Maintains session state on specific servers');
  console.log('='.repeat(70) + '\n');
}

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to Maestro WebSocket');
  // Subscribe to this session's events
  ws.send(JSON.stringify({
    type: 'subscribe',
    sessionIds: [SESSION_ID]
  }));
  console.log(`📡 Subscribed to session ${SESSION_ID}`);
  console.log(`⏳ Waiting for quiz submission...\n`);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    const event = message.event || message.type;

    // Log connection events
    if (event === 'subscribed') {
      console.log('✅ Subscription confirmed');
      return;
    }

    // Check for modal action events
    if (event === 'session:modal_action') {
      const { modalId, action, data: actionData } = message.data;

      console.log(`📥 Received modal action: ${action}`);

      if (action === 'submit_answer') {
        console.log('\n🎓 Grading your quiz...\n');
        const results = gradeQuiz(actionData);
        displayResults(results);

        // Exit after displaying results
        console.log('✅ Grading complete!\n');
        ws.close();
        process.exit(0);
      }
    }

    // Check for modal closed
    if (event === 'session:modal_closed') {
      console.log('\n⚠️  Modal was closed without submission');
      ws.close();
      process.exit(0);
    }
  } catch (err) {
    console.error('Error processing message:', err.message);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('🔌 Disconnected from WebSocket');
});

// Keep the process alive
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted by user');
  ws.close();
  process.exit(0);
});

console.log('Press Ctrl+C to stop listening\n');
