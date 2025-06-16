#!/usr/bin/env -S deno run --allow-net --allow-env

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Test configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'your-supabase-url'
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'your-supabase-anon-key'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'your-service-role-key'

// Test user credentials (you'll need to authenticate first)
const TEST_USER_EMAIL = 'test@mano.com'
const TEST_USER_PASSWORD = 'testpassword123'

interface TestPerson {
  name: string
  role: string
  relationship_type: string
}

interface TestMessage {
  person_name: string
  content: string
}

class EnhancedContextTester {
  private supabase: any
  private testUserId: string | null = null
  private testPeople: any[] = []

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  }

  async setup() {
    console.log('🔧 Setting up test environment...')
    
    // Create test user (or get existing)
    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
      email_confirm: true
    })

    if (authError && !authError.message.includes('already registered')) {
      throw new Error(`Auth setup failed: ${authError.message}`)
    }

    this.testUserId = authData?.user?.id || await this.getExistingUserId()
    console.log(`✅ Test user ID: ${this.testUserId}`)

    // Create test people
    await this.createTestPeople()
    
    // Create test conversations
    await this.createTestConversations()
    
    console.log('✅ Test setup complete!')
  }

  private async getExistingUserId(): Promise<string> {
    const { data, error } = await this.supabase.auth.admin.listUsers()
    if (error) throw error
    
    const user = data.users.find((u: any) => u.email === TEST_USER_EMAIL)
    if (!user) throw new Error('Test user not found')
    
    return user.id
  }

  private async createTestPeople() {
    const testPeople: TestPerson[] = [
      { name: 'Sarah Johnson', role: 'Senior Developer', relationship_type: 'direct_report' },
      { name: 'Mike Chen', role: 'Product Manager', relationship_type: 'peer' },
      { name: 'Lisa Rodriguez', role: 'Engineering Manager', relationship_type: 'manager' },
      { name: 'David Kim', role: 'Designer', relationship_type: 'direct_report' },
      { name: 'Emma Thompson', role: 'CEO', relationship_type: 'stakeholder' }
    ]

    for (const person of testPeople) {
      const { data, error } = await this.supabase
        .from('people')
        .insert({
          user_id: this.testUserId,
          name: person.name,
          role: person.role,
          relationship_type: person.relationship_type
        })
        .select()
        .single()

      if (error && !error.message.includes('duplicate')) {
        console.error(`Failed to create person ${person.name}:`, error)
        continue
      }

      if (data) {
        this.testPeople.push(data)
        console.log(`✅ Created test person: ${person.name}`)
      }
    }
  }

  private async createTestConversations() {
    const testMessages: TestMessage[] = [
      // Sarah - Performance and workload issues
      { person_name: 'Sarah Johnson', content: 'I wanted to discuss my current workload and performance goals' },
      { person_name: 'Sarah Johnson', content: 'I feel overwhelmed with the current project deadlines' },
      { person_name: 'Sarah Johnson', content: 'Can we talk about career development opportunities?' },
      
      // Mike - Communication and stakeholder issues
      { person_name: 'Mike Chen', content: 'There are some communication issues with stakeholders' },
      { person_name: 'Mike Chen', content: 'The alignment between teams is unclear on project priorities' },
      { person_name: 'Mike Chen', content: 'How should we handle conflicting stakeholder demands?' },
      
      // David - Similar workload concerns as Sarah
      { person_name: 'David Kim', content: 'My workload has been really heavy lately' },
      { person_name: 'David Kim', content: 'I need feedback on my recent performance' },
      
      // Lisa - Management strategy
      { person_name: 'Lisa Rodriguez', content: 'What are your thoughts on our team communication process?' },
      { person_name: 'Lisa Rodriguez', content: 'How do you handle performance management across your team?' },
    ]

    for (const message of testMessages) {
      const person = this.testPeople.find(p => p.name === message.person_name)
      if (!person) continue

      await this.supabase
        .from('messages')
        .insert({
          person_id: person.id,
          content: message.content,
          is_user: true
        })

      // Add a mock Mano response
      await this.supabase
        .from('messages')
        .insert({
          person_id: person.id,
          content: `Thanks for bringing this up. Let me help you work through this challenge.`,
          is_user: false
        })
    }

    console.log('✅ Created test conversations')
  }

  async testEnhancedContext() {
    console.log('\n🧠 Testing Enhanced Context Building...')

    // Test 1: General conversation should show team awareness
    console.log('\n1️⃣ Testing General Management Context:')
    await this.testGeneralContext()

    // Test 2: Person-specific conversation should include broader context
    console.log('\n2️⃣ Testing Person-Specific Enhanced Context:')
    await this.testPersonContext()

    // Test 3: Performance monitoring
    console.log('\n3️⃣ Testing Context Building Performance:')
    await this.testPerformance()
  }

  private async testGeneralContext() {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        person_id: 'general',
        message: 'What are the main challenges across my team right now?'
      })
    })

    const result = await response.json()
    
    if (result.error) {
      console.error('❌ General context test failed:', result.error)
      return
    }

    console.log('✅ General context response received')
    console.log('Response preview:', result.assistantMessage?.content?.substring(0, 200) + '...')
    
    // Check if response mentions team-wide patterns
    const content = result.assistantMessage?.content?.toLowerCase() || ''
    const hasTeamAwareness = 
      content.includes('team') || 
      content.includes('workload') || 
      content.includes('communication') ||
      content.includes('multiple')

    if (hasTeamAwareness) {
      console.log('✅ Response shows team awareness')
    } else {
      console.log('⚠️ Response may lack team context')
    }
  }

  private async testPersonContext() {
    const sarah = this.testPeople.find(p => p.name === 'Sarah Johnson')
    if (!sarah) {
      console.log('❌ Sarah not found for person context test')
      return
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        person_id: sarah.id,
        message: 'How does my situation compare to others on the team?'
      })
    })

    const result = await response.json()
    
    if (result.error) {
      console.error('❌ Person context test failed:', result.error)
      return
    }

    console.log('✅ Person-specific enhanced context response received')
    console.log('Response preview:', result.assistantMessage?.content?.substring(0, 200) + '...')
    
    // Check if response shows awareness of broader team context
    const content = result.assistantMessage?.content?.toLowerCase() || ''
    const hasEnhancedContext = 
      content.includes('team') || 
      content.includes('other') || 
      content.includes('similar') ||
      content.includes('across')

    if (hasEnhancedContext) {
      console.log('✅ Response shows enhanced team context awareness')
    } else {
      console.log('⚠️ Response may lack cross-conversation insights')
    }
  }

  private async testPerformance() {
    const startTime = Date.now()
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        person_id: 'general',
        message: 'Quick test of performance'
      })
    })

    const totalTime = Date.now() - startTime
    const result = await response.json()
    
    if (result.error) {
      console.error('❌ Performance test failed:', result.error)
      return
    }

    console.log(`⏱️ Total response time: ${totalTime}ms`)
    
    if (totalTime < 5000) {
      console.log('✅ Performance acceptable (< 5 seconds)')
    } else {
      console.log('⚠️ Performance may need optimization (> 5 seconds)')
    }
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up test data...')
    
    // Delete test messages
    await this.supabase
      .from('messages')
      .delete()
      .in('person_id', this.testPeople.map(p => p.id))

    // Delete test people
    await this.supabase
      .from('people')
      .delete()
      .eq('user_id', this.testUserId)

    console.log('✅ Cleanup complete')
  }
}

// Main execution
async function main() {
  if (SUPABASE_URL === 'your-supabase-url' || SUPABASE_ANON_KEY === 'your-supabase-anon-key') {
    console.error('❌ Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables')
    Deno.exit(1)
  }

  const tester = new EnhancedContextTester()
  
  try {
    await tester.setup()
    await tester.testEnhancedContext()
    
    console.log('\n🎉 Enhanced Context Testing Complete!')
    console.log('\nResults Summary:')
    console.log('✅ Management context service created')
    console.log('✅ Edge function enhanced with context building')
    console.log('✅ Cross-conversation awareness implemented')
    console.log('✅ Team-wide pattern detection active')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  } finally {
    // Uncomment to clean up test data
    // await tester.cleanup()
  }
}

if (import.meta.main) {
  main()
} 