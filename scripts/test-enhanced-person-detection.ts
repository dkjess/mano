import { detectNewPeopleInMessage } from '../lib/enhanced-person-detection'

// Test cases for enhanced person detection
const testCases = [
  {
    description: 'Clear person mention with work context',
    message: 'I had a great meeting with Sarah today about the project',
    existingPeople: [],
    expected: ['Sarah']
  },
  {
    description: 'Person with role information',
    message: 'John (Product Manager) will be joining our team next week',
    existingPeople: [],
    expected: ['John']
  },
  {
    description: 'Multiple people in collaboration context',
    message: 'I collaborated with Maria and discussed the timeline with Alex',
    existingPeople: [],
    expected: ['Maria', 'Alex']
  },
  {
    description: 'Management relationship',
    message: 'My manager Jennifer approved the budget',
    existingPeople: [],
    expected: ['Jennifer']
  },
  {
    description: 'Direct report context',
    message: 'I manage David and he is doing excellent work',
    existingPeople: [],
    expected: ['David']
  },
  {
    description: 'False positive - company name',
    message: 'I work at Microsoft and use Teams daily',
    existingPeople: [],
    expected: []
  },
  {
    description: 'False positive - project name',
    message: 'The Phoenix project is due next week',
    existingPeople: [],
    expected: []
  },
  {
    description: 'False positive - day of week',
    message: 'I have a meeting on Friday with the team',
    existingPeople: [],
    expected: []
  },
  {
    description: 'International name with accents',
    message: 'I spoke with José about the requirements',
    existingPeople: [],
    expected: ['José']
  },
  {
    description: 'Hyphenated name',
    message: 'Mary-Jane is leading the design review',
    existingPeople: [],
    expected: ['Mary-Jane']
  },
  {
    description: 'Already existing person - should be filtered out',
    message: 'I talked to Sarah about the project',
    existingPeople: ['Sarah'],
    expected: []
  },
  {
    description: 'Mixed case with common word',
    message: 'I will meet with Will tomorrow',
    existingPeople: [],
    expected: [] // 'Will' should be filtered as common word
  },
  {
    description: 'Person in stakeholder context',
    message: 'I called Emma from the client team yesterday',
    existingPeople: [],
    expected: ['Emma']
  },
  {
    description: 'Complex sentence with multiple contexts',
    message: 'After the meeting with Robert, I emailed Lisa about the updates and scheduled a call with our manager Tom',
    existingPeople: [],
    expected: ['Robert', 'Lisa', 'Tom']
  }
]

async function runTests() {
  console.log('🧪 Testing Enhanced Person Detection System\n')
  
  let passed = 0
  let failed = 0
  
  for (const testCase of testCases) {
    console.log(`📝 ${testCase.description}`)
    console.log(`   Message: "${testCase.message}"`)
    console.log(`   Existing: [${testCase.existingPeople.join(', ')}]`)
    console.log(`   Expected: [${testCase.expected.join(', ')}]`)
    
    try {
      // Test without LLM validation first (pattern-based)
      const result = await detectNewPeopleInMessage(
        testCase.message,
        testCase.existingPeople,
        undefined // No Claude API key - use pattern-based validation
      )
      
      const detectedNames = result.detectedPeople.map(p => p.name).sort()
      const expectedNames = testCase.expected.sort()
      
      const isMatch = JSON.stringify(detectedNames) === JSON.stringify(expectedNames)
      
      if (isMatch) {
        console.log(`   ✅ PASS - Detected: [${detectedNames.join(', ')}]`)
        if (result.fallbackUsed) {
          console.log(`   ⚠️  Used fallback (pattern-based) validation`)
        }
        passed++
      } else {
        console.log(`   ❌ FAIL - Detected: [${detectedNames.join(', ')}]`)
        
        // Show detailed results for debugging
        if (result.detectedPeople.length > 0) {
          console.log(`   🔍 Details:`)
          result.detectedPeople.forEach(person => {
            console.log(`      - ${person.name} (confidence: ${person.confidence.toFixed(2)}, context: "${person.context}")`)
          })
        }
        failed++
      }
      
    } catch (error) {
      console.log(`   💥 ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
      failed++
    }
    
    console.log('')
  }
  
  console.log('📊 Test Results:')
  console.log(`   ✅ Passed: ${passed}`)
  console.log(`   ❌ Failed: ${failed}`)
  console.log(`   📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)
  
  if (failed > 0) {
    console.log('\n🔧 Some tests failed. Consider adjusting the detection patterns or validation logic.')
  } else {
    console.log('\n🎉 All tests passed! The enhanced person detection is working correctly.')
  }
}

// Additional test for LLM validation (if API key is available)
async function testLLMValidation() {
  const claudeApiKey = process.env.ANTHROPIC_API_KEY
  
  if (!claudeApiKey) {
    console.log('\n⚠️  ANTHROPIC_API_KEY not found - skipping LLM validation tests')
    return
  }
  
  console.log('\n🤖 Testing LLM Validation')
  
  const llmTestCases = [
    {
      description: 'Ambiguous case - should use LLM to clarify',
      message: 'I need to follow up with Phoenix about the project timeline',
      existingPeople: [],
      // Phoenix could be a person or project - LLM should help decide
    },
    {
      description: 'Complex context requiring understanding',
      message: 'Apple called me yesterday about the contract, but I think we should wait for Google to respond first',
      existingPeople: [],
      // Both could be companies or people - context suggests companies
    }
  ]
  
  for (const testCase of llmTestCases) {
    console.log(`📝 ${testCase.description}`)
    console.log(`   Message: "${testCase.message}"`)
    
    try {
      const result = await detectNewPeopleInMessage(
        testCase.message,
        testCase.existingPeople,
        claudeApiKey
      )
      
      console.log(`   🤖 LLM Result: [${result.detectedPeople.map(p => p.name).join(', ')}]`)
      console.log(`   🎯 Fallback used: ${result.fallbackUsed ? 'Yes' : 'No'}`)
      
      if (result.detectedPeople.length > 0) {
        result.detectedPeople.forEach(person => {
          console.log(`      - ${person.name} (confidence: ${person.confidence.toFixed(2)}, validation: ${person.validationScore || 'N/A'})`)
        })
      }
      
    } catch (error) {
      console.log(`   💥 LLM ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    
    console.log('')
  }
}

// Run tests
runTests().then(() => testLLMValidation()) 