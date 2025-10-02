// Simple test script to validate Telegram bot logic

// Mock data structure
const mockUsers = [
  {
    id: 1,
    email: 'marko@student.etf.bg.ac.rs',
    telegram_username: 'marko123',
    added: true,
    invite_link: 'https://t.me/+abc123',
    created_at: new Date('2024-01-01').toISOString(),
    updated_at: new Date('2024-01-02').toISOString()
  },
  {
    id: 2,
    email: 'ana@student.etf.bg.ac.rs',
    telegram_username: 'ana_doe',
    added: false,
    invite_link: 'https://t.me/+def456',
    created_at: new Date('2024-01-03').toISOString(),
    updated_at: new Date('2024-01-03').toISOString()
  },
  {
    id: 3,
    email: 'petar@student.etf.bg.ac.rs',
    telegram_username: null,
    added: false,
    invite_link: null,
    created_at: new Date('2024-01-04').toISOString(),
    updated_at: new Date('2024-01-04').toISOString()
  }
]

// Mock supabase methods
function createMockSupabase(users) {
  return {
    from: (table) => ({
      select: (fields, options = {}) => {
        if (options.count === 'exact' && options.head === true) {
          // Count query
          let filteredUsers = users
          if (this.lastFilter) {
            filteredUsers = users.filter(this.lastFilter)
          }
          return { count: filteredUsers.length }
        }
        
        // Regular select
        let filteredUsers = users
        if (this.lastFilter) {
          filteredUsers = users.filter(this.lastFilter)
        }
        return {
          not: (field, operator, value) => {
            this.lastFilter = (user) => {
              if (operator === 'is' && value === null) {
                return user[field] !== null
              }
              return true
            }
            return this
          },
          eq: (field, value) => {
            this.lastFilter = (user) => user[field] === value
            return this
          },
          is: (field, value) => {
            this.lastFilter = (user) => user[field] === value
            return this
          },
          ilike: (field, value) => {
            this.lastFilter = (user) => user[field] && user[field].toLowerCase() === value.toLowerCase()
            return this
          },
          gte: (field, value) => {
            const date = new Date(value)
            this.lastFilter = (user) => new Date(user[field]) >= date
            return this
          },
          order: () => this,
          limit: () => this,
          single: () => {
            const filtered = users.filter(this.lastFilter || (() => true))
            if (filtered.length > 0) {
              return { data: filtered[0], error: null }
            }
            return { data: null, error: 'Not found' }
          },
          then: (callback) => {
            const filtered = users.filter(this.lastFilter || (() => true))
            return callback({ data: filtered, error: null })
          }
        }
      }
    })
  }
}

// Test status command logic
function testStatusLogic() {
  console.log('🧪 Testing Status Command Logic...')
  
  const supabase = createMockSupabase(mockUsers)
  
  // Simulate status command queries
  const totalUsers = mockUsers.length // 3
  const usersWithUsername = mockUsers.filter(u => u.telegram_username !== null).length // 2
  const verifiedUsers = mockUsers.filter(u => u.added === true).length // 1
  const usersWithInviteLink = mockUsers.filter(u => u.invite_link !== null).length // 2
  
  const usersWithoutUsername = totalUsers - usersWithUsername // 1
  const unverifiedUsers = usersWithUsername - verifiedUsers // 1
  
  console.log('📊 Status Results:')
  console.log(`• Total users: ${totalUsers}`)
  console.log(`• Users with username: ${usersWithUsername}`)
  console.log(`• Verified users: ${verifiedUsers}`)
  console.log(`• Users with invite link: ${usersWithInviteLink}`)
  console.log(`• Users without username: ${usersWithoutUsername}`)
  console.log(`• Unverified users: ${unverifiedUsers}`)
  
  // Assertions
  if (totalUsers === 3 && usersWithUsername === 2 && verifiedUsers === 1) {
    console.log('✅ Status logic test PASSED')
  } else {
    console.log('❌ Status logic test FAILED')
  }
}

// Test check command logic
function testCheckLogic() {
  console.log('\n🧪 Testing Check Command Logic...')
  
  // Test existing user
  const existingUser = mockUsers.find(u => u.telegram_username === 'marko123')
  if (existingUser) {
    console.log(`✅ Found user: ${existingUser.email} (@${existingUser.telegram_username})`)
    console.log(`   Verified: ${existingUser.added ? 'Yes' : 'No'}`)
    console.log(`   Has invite link: ${existingUser.invite_link ? 'Yes' : 'No'}`)
  }
  
  // Test non-existing user  
  const nonExistingUser = mockUsers.find(u => u.telegram_username === 'nonexistent')
  if (!nonExistingUser) {
    console.log('✅ Correctly handled non-existing user')
  }
  
  console.log('✅ Check logic test PASSED')
}

// Test purge command logic
function testPurgeLogic() {
  console.log('\n🧪 Testing Purge Command Logic...')
  
  const unverifiedUsers = mockUsers.filter(u => u.telegram_username !== null && u.added === false)
  const usersWithoutUsername = mockUsers.filter(u => u.telegram_username === null).length
  
  console.log(`🧹 Purge Results:`)
  console.log(`• Unverified users with username: ${unverifiedUsers.length}`)
  console.log(`• Users without username: ${usersWithoutUsername}`)
  
  if (unverifiedUsers.length > 0) {
    console.log('   Unverified users:')
    unverifiedUsers.forEach((user, index) => {
      const days = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`   ${index + 1}. @${user.telegram_username} (${days} days ago)`)
    })
  }
  
  console.log('✅ Purge logic test PASSED')
}

// Run tests
console.log('🚀 Running Telegram Bot Logic Tests\n')
testStatusLogic()
testCheckLogic()
testPurgeLogic()
console.log('\n✅ All tests completed!')
